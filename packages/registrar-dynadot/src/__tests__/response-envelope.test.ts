/**
 * PrisNames — Response Envelope Parser Unit Tests
 *
 * Tests the centralized Dynadot application-level envelope parser.
 * Validates the HTTP-status + app-code precedence decision matrix.
 */

import { describe, it, expect } from 'vitest';
import {
  parseDynadotEnvelope,
  mapDynadotAppCode,
  createAppLevelError,
} from '../response-envelope.js';
import { ProviderErrorCode } from '@prisnames/registrar-core';

describe('parseDynadotEnvelope', () => {
  describe('SUCCESS path', () => {
    it('detects code 200 as SUCCESS', () => {
      const result = parseDynadotEnvelope({ code: 200, message: 'OK', data: { balance: 100 } });
      expect(result.status).toBe('SUCCESS');
      if (result.status === 'SUCCESS') {
        expect(result.meta.code).toBe(200);
        expect(result.data).toEqual({ balance: 100 });
      }
    });

    it('detects code 201 as SUCCESS', () => {
      const result = parseDynadotEnvelope({ code: 201, message: 'Created' });
      expect(result.status).toBe('SUCCESS');
    });

    it('supports Pascal-cased Code/Message', () => {
      const result = parseDynadotEnvelope({ Code: 200, Message: 'OK', Data: { x: 1 } });
      expect(result.status).toBe('SUCCESS');
      if (result.status === 'SUCCESS') {
        expect(result.meta.code).toBe(200);
        expect(result.data).toEqual({ x: 1 });
      }
    });

    it('extracts data from top-level when no data field', () => {
      const body = { code: 200, message: 'OK', account_balance: 500 };
      const result = parseDynadotEnvelope(body);
      expect(result.status).toBe('SUCCESS');
      if (result.status === 'SUCCESS') {
        // Falls back to entire object as data
        expect(result.data).toEqual(body);
      }
    });
  });

  describe('ACCEPTED path', () => {
    it('detects code 202 as ACCEPTED', () => {
      const result = parseDynadotEnvelope({ code: 202, message: 'Accepted' });
      expect(result.status).toBe('ACCEPTED');
      if (result.status === 'ACCEPTED') {
        expect(result.meta.code).toBe(202);
      }
    });
  });

  describe('APP_ERROR path (HTTP 200 + app code >= 400)', () => {
    it('detects code 400 as APP_ERROR', () => {
      const result = parseDynadotEnvelope({
        code: 400,
        message: 'Bad Request',
        error: { description: 'Missing parameter' },
      });
      expect(result.status).toBe('APP_ERROR');
      if (result.status === 'APP_ERROR') {
        expect(result.meta.code).toBe(400);
        expect(result.meta.errorDescription).toBe('Missing parameter');
      }
    });

    it('detects code 401 as APP_ERROR', () => {
      const result = parseDynadotEnvelope({ code: 401, message: 'Unauthorized' });
      expect(result.status).toBe('APP_ERROR');
    });

    it('detects code 429 as APP_ERROR', () => {
      const result = parseDynadotEnvelope({ code: 429, message: 'Rate limited' });
      expect(result.status).toBe('APP_ERROR');
    });

    it('detects code 500 as APP_ERROR', () => {
      const result = parseDynadotEnvelope({ code: 500, message: 'Internal Server Error' });
      expect(result.status).toBe('APP_ERROR');
    });

    it('supports Pascal-cased Error.Description', () => {
      const result = parseDynadotEnvelope({
        Code: 403,
        Message: 'Forbidden',
        Error: { Description: 'IP not whitelisted' },
      });
      expect(result.status).toBe('APP_ERROR');
      if (result.status === 'APP_ERROR') {
        expect(result.meta.errorDescription).toBe('IP not whitelisted');
      }
    });
  });

  describe('PROTOCOL_ERROR path', () => {
    it('treats unrecognized positive code (e.g. 100) as PROTOCOL_ERROR', () => {
      const result = parseDynadotEnvelope({ code: 100, message: 'Continue' });
      expect(result.status).toBe('PROTOCOL_ERROR');
    });

    it('treats code 301 as PROTOCOL_ERROR', () => {
      const result = parseDynadotEnvelope({ code: 301, message: 'Moved' });
      expect(result.status).toBe('PROTOCOL_ERROR');
    });
  });

  describe('NO_ENVELOPE path', () => {
    it('null body → NO_ENVELOPE', () => {
      const result = parseDynadotEnvelope(null);
      expect(result.status).toBe('NO_ENVELOPE');
    });

    it('undefined body → NO_ENVELOPE', () => {
      const result = parseDynadotEnvelope(undefined);
      expect(result.status).toBe('NO_ENVELOPE');
    });

    it('string body → NO_ENVELOPE', () => {
      const result = parseDynadotEnvelope('hello');
      expect(result.status).toBe('NO_ENVELOPE');
    });

    it('object without code → NO_ENVELOPE', () => {
      const result = parseDynadotEnvelope({ status: 'ok', data: [1, 2, 3] });
      expect(result.status).toBe('NO_ENVELOPE');
    });

    it('NaN code → NO_ENVELOPE', () => {
      const result = parseDynadotEnvelope({ code: 'not-a-number', message: 'test' });
      expect(result.status).toBe('NO_ENVELOPE');
    });
  });

  describe('code type coercion', () => {
    it('string code "200" → SUCCESS', () => {
      const result = parseDynadotEnvelope({ code: '200', message: 'OK' });
      expect(result.status).toBe('SUCCESS');
    });

    it('string code "400" → APP_ERROR', () => {
      const result = parseDynadotEnvelope({ code: '400', message: 'Bad Request' });
      expect(result.status).toBe('APP_ERROR');
    });
  });
});

describe('mapDynadotAppCode', () => {
  it('maps 400 → VALIDATION_ERROR', () => {
    expect(mapDynadotAppCode(400)).toBe(ProviderErrorCode.VALIDATION_ERROR);
  });

  it('maps 401 → AUTHENTICATION_ERROR', () => {
    expect(mapDynadotAppCode(401)).toBe(ProviderErrorCode.AUTHENTICATION_ERROR);
  });

  it('maps 402 → INSUFFICIENT_FUNDS', () => {
    expect(mapDynadotAppCode(402)).toBe(ProviderErrorCode.INSUFFICIENT_FUNDS);
  });

  it('maps 403 → AUTHORIZATION_ERROR', () => {
    expect(mapDynadotAppCode(403)).toBe(ProviderErrorCode.AUTHORIZATION_ERROR);
  });

  it('maps 404 → DOMAIN_NOT_FOUND', () => {
    expect(mapDynadotAppCode(404)).toBe(ProviderErrorCode.DOMAIN_NOT_FOUND);
  });

  it('maps 409 → DOMAIN_STATE_CONFLICT', () => {
    expect(mapDynadotAppCode(409)).toBe(ProviderErrorCode.DOMAIN_STATE_CONFLICT);
  });

  it('maps 429 → RATE_LIMITED', () => {
    expect(mapDynadotAppCode(429)).toBe(ProviderErrorCode.RATE_LIMITED);
  });

  it('maps 500 → PROVIDER_UNAVAILABLE', () => {
    expect(mapDynadotAppCode(500)).toBe(ProviderErrorCode.PROVIDER_UNAVAILABLE);
  });

  it('maps 503 → PROVIDER_UNAVAILABLE', () => {
    expect(mapDynadotAppCode(503)).toBe(ProviderErrorCode.PROVIDER_UNAVAILABLE);
  });

  it('maps unknown code → UNKNOWN', () => {
    expect(mapDynadotAppCode(418)).toBe(ProviderErrorCode.UNKNOWN);
  });
});

describe('createAppLevelError', () => {
  it('creates DynadotApiError with correct code for app 401', () => {
    const error = createAppLevelError({ code: 401, message: 'Unauthorized' }, 'req-123');
    expect(error.code).toBe(ProviderErrorCode.AUTHENTICATION_ERROR);
    expect(error.message).toContain('401');
    expect(error.dynadotErrorCode).toBe('401');
    expect(error.retryable).toBe(false);
  });

  it('marks 429 as retryable', () => {
    const error = createAppLevelError({ code: 429, message: 'Rate limited' }, 'req-456');
    expect(error.code).toBe(ProviderErrorCode.RATE_LIMITED);
    expect(error.retryable).toBe(true);
  });

  it('marks 500 as retryable', () => {
    const error = createAppLevelError({ code: 500, message: 'Internal error' }, 'req-789');
    expect(error.code).toBe(ProviderErrorCode.PROVIDER_UNAVAILABLE);
    expect(error.retryable).toBe(true);
  });

  it('includes error description from meta', () => {
    const error = createAppLevelError(
      { code: 400, message: 'Bad Request', errorDescription: 'Missing domain param' },
      'req-abc',
    );
    expect(error.dynadotErrorMessage).toBe('Missing domain param');
  });
});
