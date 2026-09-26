/**
 * PrisNames — Dynadot Glue Record / Registered Nameserver Facet
 *
 * Managing nameserver objects (create/update/delete with glue records).
 * 6 operations matching Dynadot REST v2 server endpoints:
 * - getRegisteredNameserver: GET /nameservers/{nameserver}
 * - listRegisteredNameservers: GET /nameservers
 * - registerNameserver: POST /nameservers/register
 * - addExternalNameserver: POST /nameservers/{nameserver}/add_external
 * - updateNameserverIp: PUT /nameservers/{nameserver}/set_ip
 * - deleteNameserver: DELETE /nameservers/{nameserver}
 */

import type { GlueRecordManagementCapability } from '@prisnames/registrar-core';
import type { RegisteredNameserver } from '@prisnames/registrar-core';
import type { DynadotHttpClient } from '../http-client.js';
import { ENDPOINTS } from '../endpoints.js';

export class DynadotGlueRecordFacet implements GlueRecordManagementCapability {
  constructor(private readonly client: DynadotHttpClient) {}

  async getRegisteredNameserver(nameserver: string): Promise<RegisteredNameserver> {
    const response = await this.client.request<{
      hostname?: string;
      ip_list?: string[];
    }>(ENDPOINTS.NAMESERVER_REGISTERED_GET, {
      path: `nameservers/${encodeURIComponent(nameserver)}`,
    });

    return {
      hostname: response.data.hostname ?? nameserver,
      ips: response.data.ip_list ?? [],
    };
  }

  async listRegisteredNameservers(): Promise<RegisteredNameserver[]> {
    const response = await this.client.request<{
      nameserver_list?: Array<{ hostname?: string; ip_list?: string[] }>;
    }>(ENDPOINTS.NAMESERVER_REGISTERED_LIST, {
      path: 'nameservers',
    });

    return (response.data.nameserver_list ?? []).map(ns => ({
      hostname: ns.hostname ?? '',
      ips: ns.ip_list ?? [],
    }));
  }

  async registerNameserver(nameserver: string, ips: string[]): Promise<void> {
    await this.client.request(ENDPOINTS.NAMESERVER_REGISTER, {
      path: 'nameservers/register',
      body: { nameserver, ip_list: ips },
    });
  }

  async addExternalNameserver(nameserver: string): Promise<void> {
    await this.client.request(ENDPOINTS.NAMESERVER_ADD_EXTERNAL, {
      path: `nameservers/${encodeURIComponent(nameserver)}/add_external`,
      body: {},
    });
  }

  async updateNameserverIp(nameserver: string, ips: string[]): Promise<void> {
    await this.client.request(ENDPOINTS.NAMESERVER_SET_IP, {
      path: `nameservers/${encodeURIComponent(nameserver)}/set_ip`,
      body: { ip_list: ips },
    });
  }

  async deleteNameserver(nameserver: string): Promise<void> {
    await this.client.request(ENDPOINTS.NAMESERVER_DELETE, {
      path: `nameservers/${encodeURIComponent(nameserver)}`,
    });
  }
}
