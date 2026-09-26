
Domains  
Aftermarket  
Tools  
Resources  
Support  
EN - USD ($)  
Pristine Internet...
Change
Restful API

V2.0.0 Beta
Search Command
General
Change Log
General API
Domains
Contacts
GET
get_contact
GET
contact_list
POST
contact_create
PUT
contact_update
DELETE
contact_delete
POST
create_cn_audit
GET
get_cn_audit_status
GET
get_contact_aero_setting
PUT
set_contact_aero_setting
GET
get_contact_ca_setting
PUT
set_contact_ca_setting
GET
get_contact_eu_setting
PUT
set_contact_eu_setting
GET
get_contact_fr_setting
PUT
set_contact_fr_setting
GET
get_contact_hk_setting
PUT
set_contact_hk_setting
GET
get_contact_ie_setting
PUT
set_contact_ie_setting
GET
get_contact_it_setting
PUT
set_contact_it_setting
GET
get_contact_lt_setting
PUT
set_contact_lt_setting
GET
get_contact_lv_setting
PUT
set_contact_lv_setting
GET
get_contact_music_setting
PUT
set_contact_music_setting
GET
get_contact_no_setting
PUT
set_contact_no_setting
GET
get_contact_pt_setting
PUT
set_contact_pt_setting
GET
get_contact_ro_setting
PUT
set_contact_ro_setting
GET
get_contact_us_setting
PUT
set_contact_us_setting
Servers
Orders
Account
Folders
Aftermarkets
Others
Reseller API
Webhook
Beta Notice: This API documentation is Beta. Endpoints, fields, error codes, and behaviors may change without notice and backward compatibility is not guaranteed. Avoid relying on it for critical production workflows.
Getting Started With Our RESTful API
The Dynadot API is designed for seamless integration with your systems. Our API features predictable resource-oriented URLs, supports JSON-encoded request bodies, returns JSON-encoded and XML-encoded responses, and adheres to standard HTTP methods, authentication, and response codes.
You can use the Dynadot API in both test and live modes. The mode is determined by the API key used to authenticate your requests. Test mode allows you to simulate and validate your API integration without affecting live data or transactions.
The Dynadot API is primarily focused on domain management, order processing, and related services. You can perform actions such as registering, transferring, and renewing domains, managing DNS settings, and viewing or updating account orders.
Please note: The bulk creations, updates, deletes are not supported, and each of those request type is limited to one object or action.
Generating Your API Keys
Before you start making any API requests, it is essential to generate your API Key and API Secret.
These keys are required for authentication and to ensure the security of your actions when interacting with our API.
You can generate both the API Key and API Secret through the API section in your account settings.
1. Log in to your account at Dynadot.
2. Navigate to Tools > API.
3. Generate your API Key and API Secret from this page.


Join our Community
Have any ideas or suggestions? Talk directly to our professional engineers.
Discord
HTTP Method
The API uses standard HTTP methods to perform operations on resources:
Method	Description
GET
GET Request: Retrieve detailed information about a specified resource
POST
POST Request: Create a new resource
PUT
PUT Request: Fully update the specified resource
DELETE
DELETE Request: Remove the specified resource
URL
The base URL for all API requests is:
https://api.dynadot.com/
The Full URL format:
http://api.dynadot.com/restful/version_code/resource/{resource_identify}/action
Example :
https://api.dynadot.com/restful/v2/domains/{domain_name}/search
Version
The current version of the API is
v2.0.0
When constructing the API request URL, it is only necessary to include the major version. Minor and patch updates are designed to be backward-compatible and will not introduce changes that break your existing code. This ensures stability while allowing you to benefit from incremental improvements and fixes without needing to modify your implementation.
When future versions are released, we will maintain backward compatibility for older versions for a period of time. New features and breaking changes will be introduced in major version increments.
Header
The header of an API request contains metadata about the request. This metadata provides essential context for the server to process the request properly. Commonly used headers include:
Content-Type
Specifies the format of the data being sent in the request body. The server uses this information to parse the request correctly. Currently the only acceptable value is: application/json
Example :
Content-Type: application/json
Accept
Informs the server of the response format expected by the client.
Possible values: application/json, application/xml
Example :
Accept: application/json
Authorization
All API requests must include an API key for authentication. You can get your API key from your account dashboard.
You can generate an API key in API setting page
Authentication Header Example :
Authorization: Bearer YOUR_API_KEY
X-Request-ID
The X-Request-ID header is an optional header used to uniquely identify each API request. When included, this header helps track and correlate requests across systems and logs, making it easier to debug and monitor API activity.
The value of the X-Request-ID must be a valid UUID (Universally Unique Identifier), following the standard format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (e.g., 123e4567-e89b-12d3-a456-426614174000).
Example :
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
X-SignatureNew
The X-Signature header is a mandatory security mechanism for transactional requests, including those that retrieve sensitive information or update data. It ensures the authenticity, integrity, and non-repudiation of API requests by requiring clients to sign the request payload using HMAC-SHA256.

To generate the signature, you'll need the following values
1. API Key: Your unique API key.
2. Full Path And Query: The full path of the API endpoint along with the query parameters.
3. X-Request-Id: The request ID. If it's not available, you can enter empty string.
4. Request Body: The body of the request. If it's empty or null, you can enter empty string.

The string to sign is a combination of the values mentioned above, concatenated in the following order:
apiKey + "\n" + fullPathAndQuery + "\n" + (xRequestId or empty String) + "\n" + (requestBody or empty String)
Example
apiKey = "your_api_key"
fullPathAndQuery = "/restful/v2/some/endpoint?param=value"
xRequestId = "unique-request-id"
requestBody = "{\"key\":\"value\"}"


stringToSign = "your_api_key\n/restful/v2/some/endpoint?param=value\nunique-request-id\n{\"key\":\"value\"}"
Generate the HMAC-SHA256 Signature
After constructing stringToSign, compute the signature using HMAC-SHA256 with your secret as the key, then Base64-encode the result.
The signature is generated using the following steps:
1. Use HMAC-SHA256 algorithm.
2. Use stringToSign (UTF-8) as the input message.
3. Use your secret (UTF-8) as the key.
4. Encode the HMAC output in Base64 (standard Base64)

Apply the generated signature as the value of X-Signature in the request header
Example :
X-Signature: {HMAC-SHA256 Signature}
Example Code :

Python
import base64
import hashlib
import hmac
import uuid

def create_signature(api_key, api_secret, full_path_and_query, x_request_id, request_body=""):
    string_to_sign = (
        api_key + "\n" +
        full_path_and_query + "\n" +
        (x_request_id or "") + "\n" +
        (request_body or "")
    )

    digest = hmac.new(
        api_secret.encode("utf-8"),
        string_to_sign.encode("utf-8"),
        hashlib.sha256
    ).digest()

    return base64.b64encode(digest).decode("utf-8")


api_key = "your_api_key"
api_secret = "your_secret"
full_path_and_query = "/restful/v2/accounts/info"
x_request_id = str(uuid.uuid4())
request_body = ""

x_signature = create_signature(
    api_key,
    api_secret,
    full_path_and_query,
    x_request_id,
    request_body
)

print("X-Request-ID:", x_request_id)
print("X-Signature:", x_signature)
Body
The body of an API request is used to send data to the server. It is commonly included in POST, PUT, or PATCH requests (not typically for GET or DELETE requests).
Content Format
The format of the body data is determined by the Content-Type header. Some common formats include:
JSON
{
domainName: "domain.com",
showPrice: "yes",
currency: "USD"
}
Typical Use Cases
POST Requests: The POST method is used to create a new resource on the server. The request body usually contains the resource details..
PUT Requests: The PUT method is used to update an existing resource by replacing it entirely. The request body contains the complete updated resource.
DELETE Requests: The DELETE method is used to remove an existing resource from the server. It does not have a request body.
GET Requests: The GET method is used to retrieve an existing resource from the server. It does not have a request body
Response Format
All API responses are returned in either JSON or XML format, which format of the body data is determined by the Accept header, providing the requested data or an error message, if applicable.
Content Format
The response in general contains 3 parts: Code, Message, Data
Code: The status of the request
Message: More description of the status
Data: The Body of the response
JSON/XML
{
Code: 200,
Message: "Success",
Data: {}
}
Error Handling
HTTP Status Codes are standardized three-digit numbers returned by a server to indicate the outcome of a clients request. They provide essential information about whether the request was successfully processed, requires further action, or encountered an error. These codes are divided into five categories, each representing a distinct type of response.
Our API's status codes adhere to the HTTP/1.1 protocol, a widely accepted standard that ensures consistent and reliable communication. By using HTTP/1.1, we leverage features like persistent connections and enhanced caching to optimize client-server interactions.
2xx (Successful): Indicates that the command was received and accepted
4xx (Client Error): Signals that the client made an error in the request, such as providing invalid input or lacking proper authorization.
5xx (Server Error): Indicates that the server encountered an error or is unable to fulfill the request.
Code
Status Name
200
Success
201
Created
202
Accepted
400
Bad Request
401
Unauthorized
402
Payment Required
403
Forbidden
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
501
Not Implemented
502
Bad Gateway
503
Service Unavailable
504
Gateway Timeout
Webhook Overview
Webhooks are a powerful tool for automating processes and integrating systems. They allow you to receive real-time notifications about events or changes in your account or domain settings. By configuring webhooks, you can trigger actions in external systems, update databases, or send notifications based on specific events.
The Dynadot API supports webhook notifications for various events, such as domain registration, transfer, renewal, and expiration, so you can take appropriate actions in response.
To use webhooks, you need to provide a URL endpoint where the notifications will be sent. You can configure your webhook URL, key, and secret in your account settings. When an event occurs, Dynadot will send a POST request to the specified URL with the relevant data.
Webhook Request Header
The header of a Webhook request contains metadata about the request. This metadata provides essential context for the server to process the request properly. Commonly used headers include:
Content-Type
Specifies the format of the data being sent in the request body. The server uses this information to parse the request correctly. Currently the only acceptable value is: application/json
Example :
Content-Type: application/json
Authorization
All Webhook requests will include an Webhook key for authentication. You can get your Webhook key from your account dashboard.
You can manage your WEBHOOK_KEY in the API settings page
Authentication Header Example :
Authorization: Bearer WEBHOOK_KEY
X-Signature
The X-Signature header is a mandatory security mechanism for transactional requests, including those that retrieve sensitive information or update data. It ensures the authenticity, integrity, and non-repudiation of Webhook requests by requiring clients to sign the request payload using HMAC-SHA256.

To generate the signature, you'll need the following values
1. WEBHOOK Key: Your unique WEBHOOK key.
2. Full Path And Query: The full path of the WEBHOOK endpoint along with the query parameters.
3. X-Request-Id: The request ID. If it's not available, you can enter empty string.
4. Request Body: The body of the request. If it's empty or null, you can enter empty string.

The string to sign is a combination of the values mentioned above, concatenated in the following order:
webhookKey + "\n" + fullPathAndQuery + "\n" + (xRequestId or empty String) + "\n" + (requestBody or empty String)
Example
webhookKey = "your_webhook_key"
fullPathAndQuery = "/v2/some/endpoint?param=value"
xRequestId = "unique-request-id"
requestBody = "{\"key\":\"value\"}"


stringToSign = "your_webhook_key\n/v2/some/endpoint?param=value\nunique-request-id\n{\"key\":\"value\"}"
Generate the HMAC-SHA256 Signature
After constructing stringToSign, compute the signature using HMAC-SHA256 with your secret as the key, then Base64-encode the result.
The signature is generated using the following steps:
1. Use HMAC-SHA256 algorithm.
2. Use stringToSign (UTF-8) as the input message.
3. Use your secret (UTF-8) as the key.
4. Encode the HMAC output in Base64 (standard Base64)

Apply the generated signature as the value of X-Signature in the request header
Example :
X-Signature: {HMAC-SHA256 Signature}
Example Code :

Python
import base64
import hashlib
import hmac
import uuid

def create_signature(webhook_key, webhook_secret, full_path_and_query, x_request_id, request_body=""):
    string_to_sign = (
        webhook_key + "\n" +
        full_path_and_query + "\n" +
        (x_request_id or "") + "\n" +
        (request_body or "")
    )

    digest = hmac.new(
        webhook_secret.encode("utf-8"),
        string_to_sign.encode("utf-8"),
        hashlib.sha256
    ).digest()

    return base64.b64encode(digest).decode("utf-8")


webhook_key = "your_webhook_key"
webhook_secret = "your_secret"
full_path_and_query = "/v2/some/webhook/path"
x_request_id = str(uuid.uuid4())
request_body = ""

x_signature = create_signature(
    webhook_key,
    webhook_secret,
    full_path_and_query,
    x_request_id,
    request_body
)

print("X-Request-ID:", x_request_id)
print("X-Signature:", x_signature)
Webhook Request Format
Content Format
The body of a webhook request contains information about the event that triggered the notification. The format of the body data is determined by the Content-Type header, which is typically application/json.
The body of the request includes the following parameters:
Example:
JSON/XML
{
event: "domain_registration",
event_id: 12345,
timestamp: 1700000000000,
data: {4 items}
}
Parameters
The body of the request contains the following parameters:
Parameter	Description
event	The type of event that triggered the notification.
event_id	The id of the event that triggered the notification.
timestamp	The timestamp when the event occurred.
data	The data associated with the event.
Webhook Response Format
Content Format
The response to a webhook request will be sent in JSON format, depending on the Content-Type header specified in the request.
The response body contains information about the status of the request, such as whether it was processed successfully or encountered an error.
The response in general contains 1 part: Status
Example:
JSON/XML
{
Status: "200"
}
Rate Limiting
Requests should be sent over https (secure socket) for security. Only 1 request can be processed at a time, so please wait for your current request to finish before sending another request.
You will receive different thread counts based on the price level of your account:
Price level	Thread Count	Rate Limit
Regular	1 thread	60/min (1/sec)
Bulk	5 threads	600/min (10/sec)
Super Bulk	35 threads	6000/min (100/sec)
Note: place_auction_bid & get_auction_bid are currently exempt from the above rate limit.
Example :

JSON
{
code: 429,
message: "Too Many Requests",
error: {1 item}
}
For Domain Appraisal Command, you will receive different allowed request counts based on the price level of your account:
Price level	Rate Limit
Regular	50/day
Bulk	100/day
Super Bulk	300/day
Example :

JSON
{
code: 429,
message: "Too Many Requests",
error: {1 item}
}
Sandbox
The Dynadot API Sandbox environment allows you to safely test your API integrations without affecting your live account or real funds.
How to Access the Sandbox
1. Log in to your Dynadot account and navigate to the API settings page:
2. https://www.dynadot.com/account/domain/setting/api.html
3. Generate your API Sandbox Key and API Sandbox Secret Key.
4. After generation, please allow some time for the system to activate your sandbox keys and create your Sandbox account.
5. Your Sandbox account will be pre-funded with a balance of 10,000 in all supported currencies for testing purposes.
Using the Sandbox API
The API commands in the Sandbox environment are functionally the same as the production environment.
The only difference is the base URL:
Production API URL: https://api.dynadot.com
Sandbox API URL: https://api-sandbox.dynadot.com
Important Notes
Some API commands may be unavailable in the Sandbox environment. Please refer to the specific command documentation to check for the "Support API Sandbox" label.
The Sandbox is designed primarily for testing. Certain commands may differ from Production, and the Sandbox cannot fully simulate all possible complex scenarios found in the Production environment.
Change Log Overview
A Change Log is a detailed record of changes, improvements, bug fixes, and new features introduced in each version of the API. It provides transparency for users and developers by documenting the impact of each update. It is composed of two key parts:
API Version
This part highlights the versioning system of the API, which helps developers track the evolution of features and ensure compatibility. Each API version is identified by a unique version number (e.g., v1.0.1, v2.2.3) and represents a significant milestone or release. Versioning allows users to maintain integrations with minimal disruption by opting into updates when ready.
Change Log History
The Change Log History provides detailed information about updates, bug fixes, deprecations, and enhancements introduced in each version. It outlines specific changes made to endpoints, parameters, authentication mechanisms, or response formats. This section ensures developers have full transparency about what has changed and can adjust their implementations accordingly. By maintaining a clear and detailed change log, we aim to provide developers with the tools and information needed to manage integrations effectively and confidently.
API Version
Our API is currently in version
v2.0.0
Version codes are used to systematically identify and manage API updates. They follow the Semantic Versioning (SemVer) format:
<Major>
<Minor>
<Patch>
Each component of the version code serves a specific purpose and helps developers communicate the scope and type of changes effectively.
Major Version
Definition: Represents significant changes that may break backward compatibility.
Format:
<Major>.x.x
Examples:
v1.0.0
->
v2.0.0
: A complete API redesign or incompatible schema changes.
Minor Version
Definition: Indicates backward-compatible feature additions.
Format:
x.<Minor>.x
Examples:
v1.0.0
->
v1.1.0
: Adding new endpoints or methods while maintaining backward compatibility.
Patch Version
Definition: Refers to backward-compatible bug fixes or minor improvements.
Format:
x.x.<Patch>
Examples:
v1.0.0
->
v1.1.0
: Fixing a minor bug in an API endpoint.
API Change Log
A Change Log is a detailed record of changes, improvements, bug fixes, and new features introduced in each version of software or an API. It provides transparency for users and developers by documenting the impact of each update.
A typical entry in a change log includes:
Description: A brief explanation of what was changed.
Affected Components: Specific modules, endpoints, or features impacted by the change.
Example: Added support for this new API command
<Domain Register>
Change Log History
Keep track of every change to the Dynadot API.
October 9, 2025
v2.0.0
New Features & Key Changes
• Sandbox Environment Now Live
 ◦ The Sandbox environment is officially launched and available for safe testing and integration validation.
• Mandatory X-Signature Header for Sensitive Operations
 ◦ To enhance security, the X-Signature header is now enforced for all sensitive API commands.
• (Optional) Machine-Readable API Documentation
 ◦ We now support structured, machine-readable API documentation for easier integration with automated tools.
• Search Access Restricted
 ◦ Access to certain search-related endpoints has been restricted for performance and data control reasons.
• IP whitelisting optimized
 ◦ Reseller account no longer required to enter at least 1 IP to use API(RESTful API only)


API Documentation Improvements
• Updated version selector on the documentation landing page for easier navigation
• Unified casing conventions across parameter names
• Expanded documentation and usage guidance for the bulk_search endpoint
• Added feature to hide/show side navigation
Introduced mandatory paging parameters to improve response efficiency and consistency.
 ◦ page (integer, required) – Specifies the current page index, starting from 1.
 ◦ page_size (integer, required) – Defines the number of items returned per page.
get_listings
October 9, 2025
SEARCH Command
Support multi-thread
Support API Sandbox
If calling the search command, the following parameters should be included:
Request Parameters
Expand All
show_price
Boolean
Optional
currency
String
Optional
Result Parameters
Expand All
domain_name
String
available
Boolean
premium
String
price_list
List
Error Code
Expand All
400
Bad Request
401
Unauthorized
429
Too many requests
500
Internal Server Error
503
Service Unavailable
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/domains/{domain_name}/search
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
429
500
503

Structure
{
code: "Integer",
message: "String",
data: {4 items}
}
BULK_SEARCH Command
Support multi-thread
Support API Sandbox
If calling the bulk_search command, the following parameters should be included:
Request Parameters
Expand All
timeout
Integer
Optional
show_price
Boolean
Optional
currency
String
Optional
domain_name_list
List
Result Parameters
Expand All
domain_result_list
List
Error Code
Expand All
400
Bad Request
401
Unauthorized
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/domains/bulk_search
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
POWER_SEARCH Command
Support multi-thread
Support API Sandbox
If calling the power_search command, the following parameters should be included:
Request Parameters
Collapse All
limit
Integer
Optional
The number of results per page, default is 25, maximum is 25.
cursor
Integer
Optional
The cursor for paginated results, need to use the lastTldIndex from previous response, if value is -1 get first page.
status
String
Optional
Filter by domain status, default is to search all statuses.
Supported values
available, taken, reserved_by_registry, invalid
Result Parameters
Collapse All
domain_result_list
List
The list of domain search results.
Show Properties
next_cursor
Integer
Last TLD index, pagination needed.
Error Code
Collapse All
400
Bad Request
The required parameter domain_name is missing.
The page_number must be a non-negative integer number
401
Unauthorized
The provided API key is invalid, expired, or missing. Please verify your key is correct and active.
This API is only available for specific accounts. please contact support for more information.
429
Too many requests
Too many requests. Rate limit exceeded. Please try again after 60 seconds.
500
Internal Server Error
Unexpected internal server error , please contact our support.
502
Bad Gateway
Invalid response from downstream service. Failed to parse result.
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/domains/{domain_name}/power_search_new
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
429
500
502

Structure
{
code: "Integer",
message: "String",
data: {2 items}
}
SUGGESTION_SEARCH Command
Support multi-thread
Support API Sandbox
If calling the suggestion_search command, the following parameters should be included:
Request Parameters
Collapse All
tlds
String
comma separated list of tlds.
max_count
Integer
Optional
max number of suggestions.
show_price
Boolean
Optional
If you would like to display price for available search result.
currency
String
Optional
The currency of the price result.
Supported values
usd, gbp, eur, inr, pln, zar, ltl, cny, cad, jpy, nzd, rub, aud, mxn, brl, idr, ars, cop, dkk, rsd, hkd, chf, aed, myr, ngn, kes, czk, btc, nok, thb, php, krw
Result Parameters
Collapse All
domain_list
List
List of domain suggestions.
Show Properties
Error Code
Collapse All
400
Bad Request
The required parameter {parameter} is missing.
The [domain_name] must be in ascii characters
The [domain_name] cannot include whitespace
The [domain_name] must be all lowercase
The [domain_name] contains invalid characters
The [domain_name] must be fully qualified
Unsupported domain type: [domain_name]
Subdomains are not allowed: [domain_name]
The tlds cannot be empty.
The value for parameter {parameter} is invalid.
401
Unauthorized
The provided API key is invalid, expired, or missing. Please verify your key is correct and active.
404
Not Found
Can not find the account.
429
Too many requests
Too many requests. Rate limit exceeded. Please try again after 60 seconds.
500
Internal Server Error
Unexpected internal server error , please contact our support.
502
Bad Gateway
Could not find any suggestions
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/domains/{domain_name}/suggestion_search
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
404
429
500
502

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
GET_PENDING_PUSH_ACCEPT_REQUEST Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the get_pending_push_accept_request command, the following parameters should be included:
Request Parameters
Collapse All
Result Parameters
Collapse All
domain_name_list
List
List of domain names.
Error Code
Collapse All
400
Bad Request
The required parameter domain_name is missing.
The {parameter} must be in ascii characters
The [domain_name] cannot include whitespace
The [domain_name] must be all lowercase
The [domain_name] contains invalid characters
The [domain_name] must be fully qualified
Unsupported domain type: [domain_name]
Subdomains are not allowed: [domain_name]
The [domain_name] contains invalid punycode.
The [domain_name] type does not support IDNs
Incomplete account information
401
Unauthorized
The provided API key is invalid, expired, or missing. Please verify your key is correct and active.
404
Not Found
No push orders found
429
Too many requests
Too many requests. Rate limit exceeded. Please try again after 60 seconds.
500
Internal Server Error
Unexpected internal server error , please contact our support.
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/domains/pending_accept_pushes
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
POST_GRACE_DELETE Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the post_grace_delete command, the following parameters should be included:
Request Parameters
Collapse All
Error Code
Collapse All
400
Bad Request
The required parameter domain_name is missing.
The domain must be transferred out.
The [domain_name] must be in ascii characters
The [domain_name] cannot include whitespace
The [domain_name] must be all lowercase
The [domain_name] contains invalid characters
The [domain_name] must be fully qualified
Unsupported domain type: [domain_name]
Subdomains are not allowed: [domain_name]
The domain is still within the grace period
401
Unauthorized
The provided API key is invalid, expired, or missing. Please verify your key is correct and active.
404
Not Found
Can not find the account.
Can not find the [domain_name] in the account.
409
Conflict
The [domain_name] was UDRP locked.
429
Too many requests
Too many requests. Rate limit exceeded. Please try again after 60 seconds.
500
Internal Server Error
Unexpected internal server error , please contact our support.
Api Request and Header

Production

JSON
DELETE
https://api.dynadot.com/restful/v2/domains/{domain_name}/post_grace_delete
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
GET_DNSSEC Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the get_dnssec command, the following parameters should be included:
Request Parameters
Collapse All
Result Parameters
Collapse All
dnssec_info_list
List
dnssecInfoList.
Show Properties
Error Code
Collapse All
400
Bad Request
The required parameter [domain_name] is missing.
The [domain_name] must be in ascii characters
The [domain_name] cannot include whitespace
The [domain_name] must be all lowercase
The [domain_name] contains invalid characters
The [domain_name] must be fully qualified
Unsupported domain type: [domain_name]
Subdomains are not allowed: [domain_name]
The domain doesn't support DNSSEC.
The [domain_name] was expired.
401
Unauthorized
The provided API key is invalid, expired, or missing. Please verify your key is correct and active.
404
Not Found
Can not find the [domain_name] in the account.
429
Too many requests
Too many requests. Rate limit exceeded. Please try again after 60 seconds.
500
Internal Server Error
Unexpected internal server error , please contact our support.
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/domains/{domain_name}/dnssec
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
DOMAIN_LIST Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the domain_list command, the following parameters should be included:
Request Parameters
Collapse All
sort
String
Optional
The sort type.
Supported values
count_asc, count_desc, name_asc, name_desc
page_size
Integer
Optional
The count per page.
page
Integer
Optional
The page index.
status
String
Optional
The domain status, default is active.
Supported values
all : { all }
active : { active }
inactive : { inactive }
deleted_grace : { deleted grace }
transferaway : { transferaway }
expired : { expired }
moved_pull : { moved (pull) }
deleted_by_cust : { deleted by cust }
deleted_by_admin : { deleted by admin }
moved_push : { moved (push) }
tag_released : { tag released }
moved_expired_auction : { moved (expired auction) }
moved_sold : { moved (sold) }
deleted_by_registry : { deleted by registry }
moved_user_auction : { moved (user auction) }
transferaway_expired_auction : { transferaway (expired auction) }
transferaway_user_auction : { transferaway (user auction) }
transferaway_listing : { transferaway (listing) }
moved_last_chance_auction : { moved (last chance auction) }
expired_pull : { expired (pull) }
installment_push_back_to_seller : { installment (push back to seller) }
moved_portfolio_auction : { moved (portfolio auction) }
moved_registry_auction : { moved (registry auction) }
installment_reverse_push_back_to_seller : { installment (reverse push back to seller) }
expired_auction : { expired (auction) }
expired_closeout : { expired (closeout) }
remote_out : { remote out }
Result Parameters
Collapse All
domain_info_list
List
The domain list.
Show Properties
pagination_result
Object
The Pagination Result.
Show Properties
Error Code
Collapse All
400
Bad Request
The value for parameter {parameter} is invalid.
The page is out of range
401
Unauthorized
The provided API key is invalid, expired, or missing. Please verify your key is correct and active.
404
Not Found
Can not find the account.
429
Too many requests
Too many requests. Rate limit exceeded. Please try again after 60 seconds.
500
Internal Server Error
Unexpected internal server error , please contact our support.
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/domains
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {2 items}
}
DOMAIN_INFO Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the domain_info command, the following parameters should be included:
Request Parameters
Collapse All
Result Parameters
Collapse All
domain_info
Object
The domain info.
Show Properties
Error Code
Collapse All
400
Bad Request
The required parameter [domain_name] is missing.
The [domain_name] must be in ascii characters
The [domain_name] cannot include whitespace
The [domain_name] must be all lowercase
The [domain_name] contains invalid characters
The [domain_name] must be fully qualified
Unsupported domain type: [domain_name]
Subdomains are not allowed: [domain_name]
401
Unauthorized
The provided API key is invalid, expired, or missing. Please verify your key is correct and active.
404
Not Found
Can not find the account.
Can not find the domain in the account.
429
Too many requests
Too many requests. Rate limit exceeded. Please try again after 60 seconds.
500
Internal Server Error
Unexpected internal server error , please contact our support.
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/domains/{domain_name}
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
RESTORE Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the restore command, the following parameters should be included:
Request Parameters
Collapse All
currency
String
Optional
Using the account default currency if not specify.
Supported values
usd, gbp, eur, inr, pln, zar, ltl, cny, cad, jpy, nzd, rub, aud, mxn, brl, idr, ars, cop, dkk, rsd, hkd, chf, aed, myr, ngn, kes, czk, btc, nok, thb, php, krw
coupon_code
String
Optional
The coupon code plan to be used in the order.
Result Parameters
Collapse All
order_id
Integer
This is your domain restore order id.
Error Code
Collapse All
400
Bad Request
The required parameter [domain_name] is missing.
The [domain_name] must be in ascii characters
The [domain_name] cannot include whitespace
The [domain_name] must be all lowercase
The [domain_name] contains invalid characters
The [domain_name] must be fully qualified
Unsupported domain type: [domain_name]
Subdomains are not allowed: [domain_name]
The [domain_name] is not supported by your account type.
401
Unauthorized
The provided API key is invalid, expired, or missing. Please verify your key is correct and active.
402
Payment Required
Insufficient funds.
403
Forbidden
Your account is unable to submit new orders.
You are disabled from buying CNNIC domain.
404
Not Found
Can not find the [account].
Can not find the [domain_name].
409
Conflict
The [domain_name] is disabled.
The domain is not restartable.
Item already existed.
429
Too many requests
Too many requests. Rate limit exceeded. Please try again after 60 seconds.
500
Internal Server Error
Unexpected internal server error , please contact our support.
Unable to get restore status of the domain.
The domain is in a unexpected status, please retry later.
Unable to get restore price, please try again later.
Problem creating restore item.
503
Service Unavailable
Registry connection offline
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/domains/{domain_name}/restore
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
currency: "String",
coupon_code: "String"
}
Response
200
400
401
402
403
404
409
429
500
503

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
DOMAIN_APPRAISAL Command
Support multi-thread
Support API Sandbox
If calling the domain_appraisal command, the following parameters should be included:
Request Parameters
Collapse All
Result Parameters
Collapse All
appraisal_price
String
The appraisal price for the domain.
Error Code
Collapse All
400
Bad Request
The required parameter [domain_name] is missing.
The [domain_name] must be in ascii characters
The [domain_name] cannot include whitespace
The [domain_name] must be all lowercase
The [domain_name] contains invalid characters
The [domain_name] must be fully qualified
Unsupported domain type: [domain_name]
Subdomains are not allowed: [domain_name]
401
Unauthorized
The provided API key is invalid, expired, or missing. Please verify your key is correct and active.
404
Not Found
Can not find the [account].
429
Too many requests
Daily quota for the command has been reached. Please try again tomorrow.
Too many requests. Rate limit exceeded. Please try again after 60 seconds.
500
Internal Server Error
Unexpected internal server error , please contact our support.
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/domains/{domain_name}/appraisal
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
DOMAIN_GET_TLD_PRICE Command
Support multi-thread
Support API Sandbox
If calling the domain_get_tld_price command, the following parameters should be included:
Request Parameters
Collapse All
currency
String
The currency you would like to use for the search.
Supported values
usd, gbp, eur, inr, pln, zar, ltl, cny, cad, jpy, nzd, rub, aud, mxn, brl, idr, ars, cop, dkk, rsd, hkd, chf, aed, myr, ngn, kes, czk, btc, nok, thb, php, krw
page
Integer
Optional
The page index.
page_size
Integer
Optional
The count per page.
sort
String
Optional
The sort : name_asc, name_desc, etc.
Supported values
rank_asc, rank_desc, name_asc, name_desc, sales_asc, sales_desc, launch_date_asc, launch_date_desc, count_asc, count_desc, registry_asc, registry_desc
show_multi_year
Boolean
Optional
Whether to show multi-year prices.
tlds
List
Optional
The comma-separated TLD list to filter the search results. If not provided, all TLDs will be included.
Result Parameters
Collapse All
page
Integer
The page index.
page_size
Integer
The count per page.
sort
String
The sort : name_asc, name_desc, etc.
Supported values
rank_asc, rank_desc, name_asc, name_desc, sales_asc, sales_desc, launch_date_asc, launch_date_desc, count_asc, count_desc, registry_asc, registry_desc
price_level
String
The price level.
currency
String
The currency you would like to use for the search.
show_multi_year_price
Boolean
Whether to show multi-year prices.
tld_price_list
List
The list of TLD prices.
Show Properties
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/domains/get_tld_price
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {7 items}
}
SET_DOMAIN_FORWARDING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_domain_forwarding command, the following parameters should be included:
Request Parameters
Collapse All
forward_url
String
The URL you want your domain to forward to. Please note that the parameter must be encoded so that the API call is interpreted properly.
is_temporary
Boolean
Optional
Forward status of your domain you want, default value is "true", if you want to forward permanently, use this parameter with "false".
enable_domain_variable
Boolean
Optional
You will be able to use the $domain$ variable to insert the domain name into your URL. (Example:https://anotherdomain.com/$domain$).
enable_wildcard_forwarding
Boolean
Optional
Webpage should always end with / if wildcard is enabled (ie https://anotherdomain.com/mypath/). https://forwardeddomain.com/mypage.html will be forwarded to https://anotherdomain.com/mypath/mypage.html.
Error Code
Collapse All
400
Bad Request
The required parameter [domain_name] is missing.
The [domain_name] must be in ascii characters
The [domain_name] cannot include whitespace
The [domain_name] must be all lowercase
The [domain_name] contains invalid characters
The [domain_name] must be fully qualified
Unsupported domain type: [domain_name]
Subdomains are not allowed: [domain_name]
The value for parameter [forward_url] is invalid.
When wildcard forwarding is enabled, the forward_url must end with a '/'.
Cannot forward to itself (the same domain).
The [domain_name] was expired.
Cannot forward to itself (the same domain).
401
Unauthorized
The provided API key is invalid, expired, or missing. Please verify your key is correct and active.
404
Not Found
Can not find the [domain_name] in the account.
409
Conflict
The [domain_name] is disabled.
The [domain_name] was UDRP locked.
Could not forward [domain_name]. Try again later.
429
Too many requests
Too many requests. Rate limit exceeded. Please try again after 60 seconds.
500
Internal Server Error
Unexpected internal server error , please contact our support.
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/domains/{domain_name}/domain_forwarding
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
forward_url: "String",
is_temporary: false,
enable_domain_variable: false,
enable_wildcard_forwarding: false
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
REGISTER Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the register command, the following parameters should be included:
Request Parameters
Expand All
domain
Object
currency
String
Optional
register_premium
Boolean
Optional
coupon_code
String
Optional
Result Parameters
Expand All
domain_name
String
expiration_date
Long
Error Code
Expand All
400
Bad Request
401
Unauthorized
402
Payment Required
403
Forbidden
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
502
Bad Gateway
503
Service Unavailable
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/domains/{domain_name}/register
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
domain: {13 items},
currency: "String",
register_premium: false,
coupon_code: "String"
}
Response
200
400
401
402
403
404
409
429
500
502
503

Structure
{
code: "Integer",
message: "String",
data: {2 items}
}
RENEW Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the renew command, the following parameters should be included:
Request Parameters
Expand All
duration
Integer
year
Integer
currency
String
Optional
coupon
String
Optional
no_renew_if_late_renew_fee_needed
Boolean
Optional
Result Parameters
Expand All
expiration_date
Long
Error Code
Expand All
400
Bad Request
401
Unauthorized
402
Payment Required
403
Forbidden
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
503
Service Unavailable
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/domains/{domain_name}/renew
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
duration: 0,
year: 0,
currency: "String",
coupon: "String",
no_renew_if_late_renew_fee_needed: false
}
Response
200
400
401
402
403
404
409
429
500
503

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
TRANSFER_IN Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the transfer_in command, the following parameters should be included:
Request Parameters
Collapse All
domain
Object
The domain name.
Show Properties
currency
String
Optional
Using the account default currency if not specify.
Supported values
usd, gbp, eur, inr, pln, zar, ltl, cny, cad, jpy, nzd, rub, aud, mxn, brl, idr, ars, cop, dkk, rsd, hkd, chf, aed, myr, ngn, kes, czk, btc, nok, thb, php, krw
transfer_premium
Boolean
Optional
If you're considering transfer a premium domain.
coupon_code
String
Optional
The coupon code plan to be used in the order.
Error Code
Collapse All
400
Bad Request
The value for parameter duration can only be 1.
The required parameter auth_code is missing.
The domain is not supported by your account type.
Could not parse contact.
401
Unauthorized
The provided API key is invalid, expired, or missing. Please verify your key is correct and active.
402
Payment Required
Insufficient funds.
403
Forbidden
Your account is unable to submit new orders.
404
Not Found
Can not find the account.
409
Conflict
The domain is not available
Coupon not permitted for this account.
There is already a transfer request in progress for the domain [domain_name].
Problem checking premium, please contact customer support.
This domain is a premium domain, please specify transfer premium.
Problem creating domain, please contact our support.
Order exists already.
429
Too many requests
Too many requests. Rate limit exceeded. Please try again after 60 seconds.
500
Internal Server Error
Unexpected error, please contact our support.
We are not able to get price from registry now, please try again later.
Unexpected internal server error , please contact our support.
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/domains/{domain_name}/transfer_in
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
domain: {13 items},
currency: "String",
transfer_premium: false,
coupon_code: "String"
}
Response
200
202
400
401
402
403
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
GRACE_DELETE Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the grace_delete command, the following parameters should be included:
Request Parameters
Collapse All
add_to_waiting_list
Boolean
Optional
If need to add this domain to grace delete waiting list if the grace delete quota has been reached.
Error Code
Collapse All
400
Bad Request
The required parameter domain_name is missing.
The [domain_name] must be in ascii characters
The [domain_name] cannot include whitespace
The [domain_name] must be all lowercase
The [domain_name] contains invalid characters
The [domain_name] must be fully qualified
Unsupported domain type: [domain_name]
Subdomains are not allowed: [domain_name]
401
Unauthorized
The provided API key is invalid, expired, or missing. Please verify your key is correct and active.
403
Forbidden
Your account is unable to submit new orders.
404
Not Found
Can not find the account.
Can not find the [domain_name] in the account.
Can not find the related order.
Can not find the related order item.
409
Conflict
The [domain_name] is disabled.
The [domain_name] was UDRP locked.
The domain has been registered and cannot be grace-deleted at this time, please try again later
New accounts cannot grace delete
The domain name grace period has expired.
The domain item is not in the expected status.
Preorder domain can not be grace deleted.
The domain was renewed, can not been grace deleted anymore.
The deletion limit quota has been reached.
The domain does not exist at the registry.
Problem deleting registered name server for this domain.
Can not delete this domain.
429
Too many requests
Too many requests. Rate limit exceeded. Please try again after 60 seconds.
500
Internal Server Error
Unexpected internal server error , please contact our support.
Unexpected error, please contact our support.
503
Service Unavailable
Registry connection busy
Registry connection offline
Api Request and Header

Production

JSON
DELETE
https://api.dynadot.com/restful/v2/domains/{domain_name}/grace_delete
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
403
404
409
429
500
503

Structure
{
code: "Integer",
message: "String"
}
SET_FOLDER Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_folder command, the following parameters should be included:
Request Parameters
Expand All
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/domains/{domain_name}/folders/{folder_name}
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
SET_STEALTH_FORWARDING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_stealth_forwarding command, the following parameters should be included:
Request Parameters
Expand All
stealth_url
String
stealth_title
String
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/domains/{domain_name}/stealth_forwarding
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
stealth_url: "String",
stealth_title: "String"
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
SET_EMAIL_FORWARDING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_email_forwarding command, the following parameters should be included:
Request Parameters
Expand All
email_forward_type
String
email_alias_list
List
Optional
email_exchange_list
List
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/domains/{domain_name}/email_forwarding
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
email_forward_type: "String",
email_alias_list: [1 item],
email_exchange_list: [1 item]
}
Response
200
400
401
403
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
SET_RENEW_OPTION Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_renew_option command, the following parameters should be included:
Request Parameters
Expand All
renew_option
String
Error Code
Expand All
400
Bad Request
404
Not Found
409
Conflict
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/domains/{domain_name}/renew_option
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
renew_option: "String"
}
Response
200
400
404
409
500

Structure
{
code: "Integer",
message: "String"
}
SET_CONTACTS Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_contacts command, the following parameters should be included:
Request Parameters
Expand All
registrant_contact_id
Integer
admin_contact_id
Integer
technical_contact_id
Integer
billing_contact_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/domains/{domain_name}/contacts
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
registrant_contact_id: 0,
admin_contact_id: 0,
technical_contact_id: 0,
billing_contact_id: 0
}
Response
200
202
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
GET_TRANSFER_STATUS Command
Support multi-thread
Support API Sandbox
If calling the get_transfer_status command, the following parameters should be included:
Request Parameters
Expand All
transfer_type
String
Result Parameters
Expand All
domain_transfer_status_list
List
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/domains/{domain_name}/transfer_status
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
GET_NAMESERVER Command
Support multi-thread
Support API Sandbox
If calling the get_nameserver command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
nameserver_list
List
glue_type
String
Error Code
Expand All
400
Bad Request
404
Not Found
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/domains/{domain_name}/nameservers
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
404

Structure
{
code: "Integer",
message: "String",
data: {2 items}
}
SET_NAMESERVER Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_nameserver command, the following parameters should be included:
Request Parameters
Expand All
nameserver_list
List
Error Code
Expand All
400
Bad Request
401
Unauthorized
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/domains/{domain_name}/nameservers
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
nameserver_list: [1 item]
}
Response
200
400
401
409
429
500

Structure
{
code: "Integer",
message: "String"
}
SET_HOSTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_hosting command, the following parameters should be included:
Request Parameters
Expand All
hosting_type
String
is_model_view
Boolean
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/domains/{domain_name}/hosts
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
hosting_type: "String",
is_model_view: false
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
SET_PARKING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_parking command, the following parameters should be included:
Request Parameters
Expand All
with_ads
Boolean
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/domains/{domain_name}/parking
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
with_ads: false
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
SET_PRIVACY Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_privacy command, the following parameters should be included:
Request Parameters
Expand All
privacy_level
String
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/domains/{domain_name}/privacy
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
privacy_level: "String"
}
Response
200
400
401
403
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
SET_DNSSEC Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_dnssec command, the following parameters should be included:
Request Parameters
Expand All
key_tag
Integer
Optional
digest_type
String
Optional
digest
String
Optional
algorithm
String
flags
String
Optional
public_key
String
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/domains/{domain_name}/dnssec
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
key_tag: 0,
digest_type: "String",
digest: "String",
algorithm: "String",
flags: "String",
public_key: "String"
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
CLEAR_DNSSEC Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the clear_dnssec command, the following parameters should be included:
Request Parameters
Expand All
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
DELETE
https://api.dynadot.com/restful/v2/domains/{domain_name}/dnssec
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
CLEAR_DOMAIN_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the clear_domain_setting command, the following parameters should be included:
Request Parameters
Expand All
service_type
String
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/domains/{domain_name}/clear_domain_setting
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
service_type: "String"
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
SET_DOMAIN_LOCK_STATUS Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_domain_lock_status command, the following parameters should be included:
Request Parameters
Expand All
lock
Boolean
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/domains/{domain_name}/domain_lock
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
lock: false
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
PUSH Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the push command, the following parameters should be included:
Request Parameters
Expand All
receiver_push_username
String
receiver_email
String
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/domains/{domain_name}/push
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
receiver_push_username: "String",
receiver_email: "String"
}
Response
200
400
401
403
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
ACCEPT_PUSH Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the accept_push command, the following parameters should be included:
Request Parameters
Expand All
push_action
String
Error Code
Expand All
400
Bad Request
401
Unauthorized
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/domains/{domain_name}/accept_push
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
push_action: "String"
}
Response
200
400
401
429
500

Structure
{
code: "Integer",
message: "String"
}
GET_DNS Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the get_dns command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
glue_info
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/domains/{domain_name}/records
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
SET_DNS Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_dns command, the following parameters should be included:
Request Parameters
Expand All
dns_main_list
List
Optional
dns_sub_list
List
Optional
ttl
Long
Optional
add_dns_to_current_setting
Boolean
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/domains/{domain_name}/records
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
dns_main_list: [1 item],
dns_sub_list: [1 item],
ttl: 0,
add_dns_to_current_setting: false
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
REMOVE_DNS Command
Support multi-thread
Support API Sandbox
If calling the remove_dns command, the following parameters should be included:
Request Parameters
Expand All
dns_main_list
List
Optional
dns_sub_list
List
Optional
Result Parameters
Expand All
main_record_removed_count
Integer
sub_record_removed_count
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
DELETE
https://api.dynadot.com/restful/v2/domains/{domain_name}/records
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
429
500

Structure
{
code: "Integer",
message: "String",
data: {2 items}
}
SET_NOTE Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_note command, the following parameters should be included:
Request Parameters
Expand All
note
String
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/domains/{domain_name}/notes
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
note: "String"
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String"
}
GET_TRANSFER_AUTH_CODE Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the get_transfer_auth_code command, the following parameters should be included:
Request Parameters
Expand All
new_code
Boolean
Optional
unlock_domain_for_transfer
Boolean
Optional
Result Parameters
Expand All
auth_code
String
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/domains/{domain_name}/transfer_auth_code
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
CREATE_CNNIC_PRIVACY Command
Support multi-thread
Require X-Signature
If calling the create_cnnic_privacy command, the following parameters should be included:
Request Parameters
Expand All
display_email
String
duration
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
502
Bad Gateway
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/domains/{domain_name}/cnnic_privacy
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
display_email: "String",
duration: 0
}
Response
200
400
401
403
404
409
429
500
502

Structure
{
code: "Integer",
message: "String"
}
LIST_CNNIC_PRIVACY Command
Support multi-thread
Require X-Signature
If calling the list_cnnic_privacy command, the following parameters should be included:
Request Parameters
Expand All
key_word
String
Optional
page
Integer
Optional
page_size
Integer
Optional
Result Parameters
Expand All
cnnic_privacy_list
List
total
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/domains/cnnic_privacy
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {2 items}
}
SET_CNNIC_PRIVACY Command
Support multi-thread
Require X-Signature
If calling the set_cnnic_privacy command, the following parameters should be included:
Request Parameters
Expand All
display_email
String
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
429
Too many requests
500
Internal Server Error
502
Bad Gateway
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/domains/{domain_name}/cnnic_privacy
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
display_email: "String"
}
Response
200
400
401
403
404
429
500
502

Structure
{
code: "Integer",
message: "String"
}
REMOVE_CNNIC_PRIVACY Command
Support multi-thread
Require X-Signature
If calling the remove_cnnic_privacy command, the following parameters should be included:
Request Parameters
Expand All
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
429
Too many requests
500
Internal Server Error
502
Bad Gateway
Api Request and Header

Production

JSON
DELETE
https://api.dynadot.com/restful/v2/domains/{domain_name}/cnnic_privacy
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
403
404
429
500
502

Structure
{
code: "Integer",
message: "String"
}
GET_CONTACT Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the get_contact command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
contact
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/contacts/{contact_id}
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
CONTACT_LIST Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the contact_list command, the following parameters should be included:
Request Parameters
Expand All
whois_verification_status
String
Optional
in_use
Boolean
Optional
cnnic_cn_audit_status
String
Optional
page_size
Integer
Optional
page
Integer
Optional
Result Parameters
Expand All
contact_list
List
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/contacts
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
CONTACT_CREATE Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the contact_create command, the following parameters should be included:
Request Parameters
Expand All
contact
Object
Result Parameters
Expand All
contact_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/contacts
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
contact: {14 items}
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
CONTACT_UPDATE Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the contact_update command, the following parameters should be included:
Request Parameters
Expand All
contact
Object
Result Parameters
Expand All
contact_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/contacts/{contact_id}
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
contact: {14 items}
}
Response
200
202
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
CONTACT_DELETE Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the contact_delete command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
contact_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
DELETE
https://api.dynadot.com/restful/v2/contacts/{contact_id}
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
CREATE_CN_AUDIT Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the create_cn_audit command, the following parameters should be included:
Request Parameters
Expand All
contact_type
String
individual_id_type
String
individual_url
String
individual_license_id
String
enterprise_id_type
String
Optional
enterprise_license_id
String
Optional
enterprise_url
String
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
502
Bad Gateway
503
Service Unavailable
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/contacts/{contact_id}/create_cn_audit
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
contact_type: "String",
individual_id_type: "String",
individual_url: "String",
individual_license_id: "String",
enterprise_id_type: "String",
enterprise_license_id: "String",
enterprise_url: "String"
}
Response
200
400
401
404
429
500
502
503

Structure
{
code: "Integer",
message: "String"
}
GET_CN_AUDIT_STATUS Command
Support multi-thread
Support API Sandbox
If calling the get_cn_audit_status command, the following parameters should be included:
Request Parameters
Expand All
is_gtld
Boolean
Result Parameters
Expand All
audit_status
String
fail_reason
String
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/contacts/{contact_id}/get_cn_audit_status
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
GET_CONTACT_AERO_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the get_contact_aero_setting command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
contact_extension
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/contacts/{contact_id}/get_aero_setting
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
SET_CONTACT_AERO_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_contact_aero_setting command, the following parameters should be included:
Request Parameters
Expand All
contact_extension
Object
Result Parameters
Expand All
contact_id
Integer
Error Code
Expand All
400
Bad Request
404
Not Found
502
Bad Gateway
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/contacts/{contact_id}/set_aero_setting
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
contact_extension: {3 items}
}
Response
200
400
404
502

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
GET_CONTACT_CA_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the get_contact_ca_setting command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
contact_extension
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/contacts/{contact_id}/get_ca_setting
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
SET_CONTACT_CA_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_contact_ca_setting command, the following parameters should be included:
Request Parameters
Expand All
contact_extension
Object
Result Parameters
Expand All
contact_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/contacts/{contact_id}/set_ca_setting
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
contact_extension: {4 items}
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
GET_CONTACT_EU_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the get_contact_eu_setting command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
contact_extension
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/contacts/{contact_id}/get_eu_setting
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
SET_CONTACT_EU_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_contact_eu_setting command, the following parameters should be included:
Request Parameters
Expand All
contact_extension
Object
Result Parameters
Expand All
contact_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/contacts/{contact_id}/set_eu_setting
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
contact_extension: {2 items}
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
GET_CONTACT_FR_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the get_contact_fr_setting command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
contact_extension
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/contacts/{contact_id}/get_fr_setting
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
SET_CONTACT_FR_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_contact_fr_setting command, the following parameters should be included:
Request Parameters
Expand All
contact_extension
Object
Result Parameters
Expand All
contact_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/contacts/{contact_id}/set_fr_setting
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
contact_extension: {2 items}
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
GET_CONTACT_HK_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the get_contact_hk_setting command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
contact_extension
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/contacts/{contact_id}/get_hk_setting
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
SET_CONTACT_HK_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_contact_hk_setting command, the following parameters should be included:
Request Parameters
Expand All
contact_extension
Object
Result Parameters
Expand All
contact_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/contacts/{contact_id}/set_hk_setting
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
contact_extension: {9 items}
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
GET_CONTACT_IE_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the get_contact_ie_setting command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
contact_extension
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/contacts/{contact_id}/get_ie_setting
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
SET_CONTACT_IE_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_contact_ie_setting command, the following parameters should be included:
Request Parameters
Expand All
contact_extension
Object
Result Parameters
Expand All
contact_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/contacts/{contact_id}/set_ie_setting
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
contact_extension: {3 items}
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
GET_CONTACT_IT_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the get_contact_it_setting command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
contact_extension
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/contacts/{contact_id}/get_it_setting
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
SET_CONTACT_IT_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_contact_it_setting command, the following parameters should be included:
Request Parameters
Expand All
contact_extension
Object
Result Parameters
Expand All
contact_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/contacts/{contact_id}/set_it_setting
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
contact_extension: {3 items}
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
GET_CONTACT_LT_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the get_contact_lt_setting command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
contact_extension
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/contacts/{contact_id}/get_lt_setting
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
SET_CONTACT_LT_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_contact_lt_setting command, the following parameters should be included:
Request Parameters
Expand All
contact_extension
Object
Result Parameters
Expand All
contact_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/contacts/{contact_id}/set_lt_setting
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
contact_extension: {2 items}
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
GET_CONTACT_LV_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the get_contact_lv_setting command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
contact_extension
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/contacts/{contact_id}/get_lv_setting
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
SET_CONTACT_LV_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_contact_lv_setting command, the following parameters should be included:
Request Parameters
Expand All
contact_extension
Object
Result Parameters
Expand All
contact_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/contacts/{contact_id}/set_lv_setting
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
contact_extension: {3 items}
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
GET_CONTACT_MUSIC_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the get_contact_music_setting command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
contact_extension
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/contacts/{contact_id}/get_music_setting
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
SET_CONTACT_MUSIC_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_contact_music_setting command, the following parameters should be included:
Request Parameters
Expand All
contact_extension
Object
Result Parameters
Expand All
contact_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/contacts/{contact_id}/set_music_setting
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
contact_extension: {2 items}
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
GET_CONTACT_NO_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the get_contact_no_setting command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
contact_extension
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/contacts/{contact_id}/get_no_setting
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
SET_CONTACT_NO_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_contact_no_setting command, the following parameters should be included:
Request Parameters
Expand All
contact_extension
Object
Result Parameters
Expand All
contact_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/contacts/{contact_id}/set_no_setting
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
contact_extension: {3 items}
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
GET_CONTACT_PT_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the get_contact_pt_setting command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
contact_extension
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/contacts/{contact_id}/get_pt_setting
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
SET_CONTACT_PT_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_contact_pt_setting command, the following parameters should be included:
Request Parameters
Expand All
contact_extension
Object
Result Parameters
Expand All
contact_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/contacts/{contact_id}/set_pt_setting
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
contact_extension: {4 items}
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
GET_CONTACT_RO_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the get_contact_ro_setting command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
contact_extension
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/contacts/{contact_id}/get_ro_setting
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
SET_CONTACT_RO_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_contact_ro_setting command, the following parameters should be included:
Request Parameters
Expand All
contact_extension
Object
Result Parameters
Expand All
contact_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/contacts/{contact_id}/set_ro_setting
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
contact_extension: {4 items}
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
GET_CONTACT_US_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the get_contact_us_setting command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
contact_extension
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/contacts/{contact_id}/get_us_setting
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
SET_CONTACT_US_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_contact_us_setting command, the following parameters should be included:
Request Parameters
Expand All
contact_extension
Object
Result Parameters
Expand All
contact_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/contacts/{contact_id}/set_us_setting
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
contact_extension: {3 items}
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
NAMESERVER_GET Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the nameserver_get command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
nameserver
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/nameservers/{nameserver}
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
NAMESERVER_LIST Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the nameserver_list command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
nameserver_list
List
Error Code
Expand All
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/nameservers
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
NAMESERVER_REGISTER Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the nameserver_register command, the following parameters should be included:
Request Parameters
Expand All
nameserver
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/nameservers/register
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
nameserver: {2 items}
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
NAMESERVER_ADD_EXTERNAL Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the nameserver_add_external command, the following parameters should be included:
Request Parameters
Expand All
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/nameservers/{nameserver}/add_external
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
NAMESERVER_SET_IP Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the nameserver_set_ip command, the following parameters should be included:
Request Parameters
Expand All
ip_list
List
Result Parameters
Expand All
server_name
String
server_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/nameservers/{nameserver}/set_ip
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
ip_list: [1 item]
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {2 items}
}
NAMESERVER_DELETE Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the nameserver_delete command, the following parameters should be included:
Request Parameters
Expand All
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
DELETE
https://api.dynadot.com/restful/v2/nameservers/{nameserver}
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
ORDER_GET_STATUS Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the order_get_status command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
order_id
Integer
order_status
String
order_status_item_list
List
Error Code
Expand All
400
Bad Request
401
Unauthorized
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/orders/{order_id}
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
429
500

Structure
{
code: "Integer",
message: "String",
data: {3 items}
}
ORDER_GET_HISTORY Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the order_get_history command, the following parameters should be included:
Request Parameters
Expand All
domain_name_list
List
Optional
order_id_list
List
Optional
search_type
String
start_time
Long
Optional
end_time
Long
Optional
payment_method
List
Optional
Result Parameters
Expand All
order_list
List
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/orders
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
CANCEL_TRANSFER Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the cancel_transfer command, the following parameters should be included:
Request Parameters
Expand All
domain_name
String
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/orders/{order_id}/cancel_transfer
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
domain_name: "String"
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
AUTHORIZE_TRANSFER_AWAY Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the authorize_transfer_away command, the following parameters should be included:
Request Parameters
Expand All
domain_name
String
approve
Boolean
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/orders/{order_id}/authorize_transfer_away
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
domain_name: "String",
approve: false
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
SET_TRANSFER_AUTH_CODE Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_transfer_auth_code command, the following parameters should be included:
Request Parameters
Expand All
domain_name
String
auth_code
String
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/orders/{order_id}/update_transfer_auth_code
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
domain_name: "String",
auth_code: "String"
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String"
}
GET_INFO Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the get_info command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
account_info
Object
Error Code
Expand All
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/accounts/info
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
SET_DEFAULT_NAMESERVERS Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_default_nameservers command, the following parameters should be included:
Request Parameters
Expand All
nameserver_list
List
Result Parameters
Expand All
nameserver_list
List
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/accounts/default_nameservers
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
nameserver_list: [1 item]
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
SET_DEFAULT_DOMAIN_FORWARDING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_default_domain_forwarding command, the following parameters should be included:
Request Parameters
Expand All
forward_url
String
is_temporary
Boolean
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/accounts/default_domain_forwarding
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
forward_url: "String",
is_temporary: false
}
Response
200
400
401
429
500

Structure
{
code: "Integer",
message: "String"
}
SET_DEFAULT_STEALTH_FORWARDING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_default_stealth_forwarding command, the following parameters should be included:
Request Parameters
Expand All
stealth_url
String
stealth_title
String
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/accounts/default_stealth_forwarding
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
stealth_url: "String",
stealth_title: "String"
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String"
}
SET_DEFAULT_EMAIL_FORWARDING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_default_email_forwarding command, the following parameters should be included:
Request Parameters
Expand All
email_forward_type
String
email_alias_list
List
Optional
email_exchange_list
List
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/accounts/default_email_forwarding
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
email_forward_type: "String",
email_alias_list: [1 item],
email_exchange_list: [1 item]
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
SET_DEFAULT_CONTACTS Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_default_contacts command, the following parameters should be included:
Request Parameters
Expand All
registrant_contact_id
Integer
admin_contact_id
Integer
technical_contact_id
Integer
billing_contact_id
Integer
Error Code
Expand All
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/accounts/default_contacts
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
registrant_contact_id: 0,
admin_contact_id: 0,
technical_contact_id: 0,
billing_contact_id: 0
}
Response
200
401
404
429
500

Structure
{
code: "Integer",
message: "String"
}
SET_DEFAULT_PARKING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_default_parking command, the following parameters should be included:
Request Parameters
Expand All
with_ads
Boolean
Optional
Error Code
Expand All
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/accounts/default_parking
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
with_ads: false
}
Response
200
401
404
429
500

Structure
{
code: "Integer",
message: "String"
}
SET_DEFAULT_HOSTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_default_hosting command, the following parameters should be included:
Request Parameters
Expand All
hosting_type
String
Error Code
Expand All
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/accounts/default_hosts
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
hosting_type: "String"
}
Response
200
401
404
429
500

Structure
{
code: "Integer",
message: "String"
}
SET_DEFAULT_RENEW_OPTION Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_default_renew_option command, the following parameters should be included:
Request Parameters
Expand All
renew_option
String
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/accounts/default_renew_option
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
renew_option: "String"
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String"
}
SET_DEFAULT_DNS Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_default_dns command, the following parameters should be included:
Request Parameters
Expand All
dns_main_list
List
dns_sub_list
List
Optional
ttl
Long
Optional
add_dns_to_current_setting
Boolean
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/default_records
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
dns_main_list: [1 item],
dns_sub_list: [1 item],
ttl: 0,
add_dns_to_current_setting: false
}
Response
200
400
401
429
500

Structure
{
code: "Integer",
message: "String"
}
CLEAR_DEFAULT_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the clear_default_setting command, the following parameters should be included:
Request Parameters
Expand All
service_type
String
Error Code
Expand All
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/accounts/clear_default_setting
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
service_type: "String"
}
Response
200
401
404
429
500

Structure
{
code: "Integer",
message: "String"
}
SET_ACCOUNT_LOCK_STATUS Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the set_account_lock_status command, the following parameters should be included:
Request Parameters
Expand All
lock
Boolean
Error Code
Expand All
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/accounts/account_lock
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
lock: false
}
Response
200
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
FOLDER_LIST Command
Support multi-thread
Support API Sandbox
If calling the folder_list command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
folder_list
List
Error Code
Expand All
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/folders
Accept: application/json
Authorization: Bearer API_KEY
Response
200
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
FOLDER_CREATE Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the folder_create command, the following parameters should be included:
Request Parameters
Expand All
folder_name
String
Result Parameters
Expand All
folder_name
String
folder_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/folders
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
folder_name: "String"
}
Response
200
201
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String",
data: {2 items}
}
FOLDER_DELETE Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the folder_delete command, the following parameters should be included:
Request Parameters
Expand All
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
DELETE
https://api.dynadot.com/restful/v2/folders/{folder_name}
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
FOLDER_SET_NAME Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the folder_set_name command, the following parameters should be included:
Request Parameters
Expand All
new_folder_name
String
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/folders/{folder_name}/name
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
new_folder_name: "String"
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
FOLDER_SET_DNS Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the folder_set_dns command, the following parameters should be included:
Request Parameters
Expand All
dns_main_list
List
dns_sub_list
List
Optional
ttl
String
Optional
apply_for_future_domain
Boolean
Optional
sync_setting_to_existing_domains_in_this_folder
Boolean
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/folders/{folder_name}/records
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
dns_main_list: [1 item],
dns_sub_list: [1 item],
ttl: "String",
apply_for_future_domain: false,
sync_setting_to_existing_domains_in_this_folder: false
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String"
}
FOLDER_SET_NAMESERVER Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the folder_set_nameserver command, the following parameters should be included:
Request Parameters
Expand All
nameserver_list
List
apply_for_future_domain
Boolean
Optional
sync_setting_to_existing_domains_in_this_folder
Boolean
Optional
Result Parameters
Expand All
nameserver_list
List
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/folders/{folder_name}/nameservers
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
nameserver_list: [1 item],
apply_for_future_domain: false,
sync_setting_to_existing_domains_in_this_folder: false
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
FOLDER_SET_CONTACTS Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the folder_set_contacts command, the following parameters should be included:
Request Parameters
Expand All
registrant_contact_id
Integer
admin_contact_id
Integer
technical_contact_id
Integer
billing_contact_id
Integer
apply_for_future_domain
Boolean
Optional
sync_setting_to_existing_domains_in_this_folder
Boolean
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/folders/{folder_name}/contacts
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
registrant_contact_id: 0,
admin_contact_id: 0,
technical_contact_id: 0,
billing_contact_id: 0,
apply_for_future_domain: false,
sync_setting_to_existing_domains_in_this_folder: false
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
FOLDER_SET_PARKING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the folder_set_parking command, the following parameters should be included:
Request Parameters
Expand All
with_ads
Boolean
Optional
apply_for_future_domain
Boolean
Optional
sync_setting_to_existing_domains_in_this_folder
Boolean
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/folders/{folder_name}/parking
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
with_ads: false,
apply_for_future_domain: false,
sync_setting_to_existing_domains_in_this_folder: false
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String"
}
FOLDER_SET_DOMAIN_FORWARDING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the folder_set_domain_forwarding command, the following parameters should be included:
Request Parameters
Expand All
forward_url
String
is_temporary
Boolean
Optional
apply_for_future_domain
Boolean
Optional
sync_setting_to_existing_domains_in_this_folder
Boolean
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/folders/{folder_name}/domain_forwarding
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
forward_url: "String",
is_temporary: false,
apply_for_future_domain: false,
sync_setting_to_existing_domains_in_this_folder: false
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String"
}
FOLDER_SET_STEALTH_FORWARDING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the folder_set_stealth_forwarding command, the following parameters should be included:
Request Parameters
Expand All
stealth_url
String
stealth_title
String
Optional
apply_for_future_domain
Boolean
Optional
sync_setting_to_existing_domains_in_this_folder
Boolean
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/folders/{folder_name}/stealth_forwarding
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
stealth_url: "String",
stealth_title: "String",
apply_for_future_domain: false,
sync_setting_to_existing_domains_in_this_folder: false
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String"
}
FOLDER_SET_EMAIL_FORWARDING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the folder_set_email_forwarding command, the following parameters should be included:
Request Parameters
Expand All
email_forward_type
String
email_alias_list
List
Optional
email_exchange_list
List
Optional
apply_for_future_domain
Boolean
Optional
sync_setting_to_existing_domains_in_this_folder
Boolean
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/folders/{folder_name}/email_forwarding
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
email_forward_type: "String",
email_alias_list: [1 item],
email_exchange_list: [1 item],
apply_for_future_domain: false,
sync_setting_to_existing_domains_in_this_folder: false
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
FOLDER_SET_HOSTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the folder_set_hosting command, the following parameters should be included:
Request Parameters
Expand All
hosting_type
String
apply_for_future_domain
Boolean
Optional
sync_setting_to_existing_domains_in_this_folder
Boolean
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/folders/{folder_name}/hosts
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
hosting_type: "String",
apply_for_future_domain: false,
sync_setting_to_existing_domains_in_this_folder: false
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String"
}
FOLDER_SET_RENEW_OPTION Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the folder_set_renew_option command, the following parameters should be included:
Request Parameters
Expand All
renew_option
String
apply_for_future_domain
Boolean
Optional
sync_setting_to_existing_domains_in_this_folder
Boolean
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/folders/{folder_name}/renew_option
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
renew_option: "String",
apply_for_future_domain: false,
sync_setting_to_existing_domains_in_this_folder: false
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String"
}
FOLDER_CLEAR_SETTING Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the folder_clear_setting command, the following parameters should be included:
Request Parameters
Expand All
service_type
String
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/folders/{folder_name}/clear_setting
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
service_type: "String"
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
SET_FOR_SALE Command
Support multi-thread
Require X-Signature
If calling the set_for_sale command, the following parameters should be included:
Request Parameters
Expand All
for_sale_type
String
currency
String
Optional
listing_type
String
price
String
Optional
minimum_offer_price
String
Optional
installment
String
Optional
maximum_installments
Integer
Optional
category
String
Optional
sub_category
String
Optional
description
String
allow_seo_index
Boolean
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
503
Service Unavailable
Api Request and Header

Production

JSON
PUT
https://api.dynadot.com/restful/v2/aftermarkets/domains/{domain_name}/for_sales
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
for_sale_type: "String",
currency: "String",
listing_type: "String",
price: "String",
minimum_offer_price: "String",
installment: "String",
maximum_installments: 0,
category: "String",
sub_category: "String",
description: "String",
allow_seo_index: false
}
Response
200
400
401
403
404
409
429
500
503

Structure
{
code: "Integer",
message: "String"
}
SET_OTHER_PLATFORM_CONFIRM_ACTION Command
Support multi-thread
Require X-Signature
If calling the set_other_platform_confirm_action command, the following parameters should be included:
Request Parameters
Expand All
action
String
platform_type
String
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/aftermarket/domains/{domain_name}/opt_in_fast_transfer
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
action: "String",
platform_type: "String"
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
GET_LISTING_ITEM Command
Support multi-thread
If calling the get_listing_item command, the following parameters should be included:
Request Parameters
Expand All
currency
String
Result Parameters
Expand All
listing_item
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
503
Service Unavailable
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/aftermarket/listings/{domain_name}
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
404
429
500
503

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
BUY_IT_NOW Command
Support multi-thread
Require X-Signature
If calling the buy_it_now command, the following parameters should be included:
Request Parameters
Expand All
currency
String
Optional
price_to_verify
Long
Optional
Result Parameters
Expand All
order_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
402
Payment Required
403
Forbidden
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
503
Service Unavailable
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/aftermarket/listings/{domain_name}/buy_it_now
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
currency: "String",
price_to_verify: 0
}
Response
200
400
401
402
403
404
409
429
500
503

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
BUY_EXPIRED_CLOSEOUT_DOMAIN Command
Support multi-thread
Require X-Signature
If calling the buy_expired_closeout_domain command, the following parameters should be included:
Request Parameters
Expand All
currency
String
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
402
Payment Required
403
Forbidden
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
503
Service Unavailable
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/aftermarket/expired_closeouts/{domain_name}/purchase
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
currency: "String"
}
Response
200
400
401
402
403
404
409
429
500
503

Structure
{
code: "Integer",
message: "String"
}
ADD_BACKORDER_REQUEST Command
Support multi-thread
Require X-Signature
If calling the add_backorder_request command, the following parameters should be included:
Request Parameters
Expand All
Error Code
Expand All
400
Bad Request
401
Unauthorized
402
Payment Required
403
Forbidden
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
503
Service Unavailable
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/aftermarket/backorders/requests/{domain_name}
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{}
Response
200
400
401
402
403
404
409
429
500
503

Structure
{
code: "Integer",
message: "String"
}
DELETE_BACKORDER_REQUEST Command
Support multi-thread
Require X-Signature
If calling the delete_backorder_request command, the following parameters should be included:
Request Parameters
Expand All
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
503
Service Unavailable
Api Request and Header

Production

JSON
DELETE
https://api.dynadot.com/restful/v2/aftermarket/backorders/requests/{domain_name}
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
403
404
409
429
500
503

Structure
{
code: "Integer",
message: "String"
}
GET_CLOSED_AUCTIONS Command
Support multi-thread
If calling the get_closed_auctions command, the following parameters should be included:
Request Parameters
Expand All
currency
String
start_time
Long
end_time
Long
Result Parameters
Expand All
closed_auction_list
List
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
503
Service Unavailable
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/aftermarket/auctions/closed
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
404
429
500
503

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
GET_AUCTION_DETAILS Command
Support multi-thread
If calling the get_auction_details command, the following parameters should be included:
Request Parameters
Expand All
currency
String
Result Parameters
Expand All
auction_item_details
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
503
Service Unavailable
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/aftermarket/auctions/{domain_name}
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
404
429
500
503

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
GET_WHOIS_STATS Command
Support multi-thread
If calling the get_whois_stats command, the following parameters should be included:
Request Parameters
Expand All
domain_name
String
date_type
String
Result Parameters
Expand All
stats
List
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/aftermarket/whois_stats
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
BACKORDER_REQUEST_LIST Command
Support multi-thread
Require X-Signature
If calling the backorder_request_list command, the following parameters should be included:
Request Parameters
Expand All
start_time
Long
end_time
Long
Result Parameters
Expand All
backorder_request_list
List
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
503
Service Unavailable
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/aftermarket/backorders/requests
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500
503

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
PLACE_AUCTION_BID Command
Support multi-thread
Require X-Signature
If calling the place_auction_bid command, the following parameters should be included:
Request Parameters
Expand All
currency
String
bid_amount
Double
is_backorder_auction
Boolean
Optional
Result Parameters
Expand All
auction_item_details
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
402
Payment Required
403
Forbidden
404
Not Found
409
Conflict
500
Internal Server Error
503
Service Unavailable
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/aftermarket/auctions/bids/{domain_name}
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
currency: "String",
bid_amount: 0,
is_backorder_auction: false
}
Response
200
400
401
402
403
404
409
500
503

Structure
{
code: "Integer",
message: "String"
}
GET_AUCTION_BIDS Command
Support multi-thread
Require X-Signature
If calling the get_auction_bids command, the following parameters should be included:
Request Parameters
Expand All
currency
String
page_size
Integer
page
Integer
Result Parameters
Expand All
auction_bid_details
List
Error Code
Expand All
400
Bad Request
503
Service Unavailable
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/aftermarket/auctions/bids
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
503

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
SET_AUCTION_INSTALLMENT_PLAN Command
Support multi-thread
Require X-Signature
If calling the set_auction_installment_plan command, the following parameters should be included:
Request Parameters
Expand All
installment_status
String
installment_months
Integer
Optional
currency
String
Optional
Result Parameters
Expand All
monthly_payments
List
currency
String
Error Code
Expand All
400
Bad Request
404
Not Found
409
Conflict
503
Service Unavailable
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/aftermarket/auctions/{domain_name}/installment_plan
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
installment_status: "String",
installment_months: 0,
currency: "String"
}
Response
200
400
404
409
503

Structure
{
code: "Integer",
message: "String",
data: {2 items}
}
GET_AUCTION_INSTALLMENT_PLAN Command
Support multi-thread
Require X-Signature
If calling the get_auction_installment_plan command, the following parameters should be included:
Request Parameters
Expand All
currency
String
Optional
Result Parameters
Expand All
currency
String
current_plan
Object
available_plans
List
Error Code
Expand All
400
Bad Request
403
Forbidden
404
Not Found
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/aftermarket/auctions/{domain_name}/installment_plan
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
403
404

Structure
{
code: "Integer",
message: "String",
data: {3 items}
}
GET_OPEN_AUCTIONS Command
Support multi-thread
If calling the get_open_auctions command, the following parameters should be included:
Request Parameters
Expand All
currency
String
auction_types
List
Optional
page_size
Integer
page
Integer
sort
String
Optional
has_bids
Boolean
Optional
Result Parameters
Expand All
auction_detail_info_list
List
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
503
Service Unavailable
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/aftermarket/auctions/open
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
404
429
500
503

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
ADD_USER_AUCTION Command
Support multi-thread
Require X-Signature
If calling the add_user_auction command, the following parameters should be included:
Request Parameters
Expand All
currency
String
Optional
starting_price
Long
description
String
Optional
google_analytics_id
String
Optional
auto_relist
Boolean
Optional
can_installment
Boolean
Optional
max_installment_month
Integer
Optional
revert_previous_dns
Boolean
Optional
Result Parameters
Expand All
auction_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
502
Bad Gateway
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/aftermarket/auctions/{domain_name}
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
currency: "String",
starting_price: 0,
description: "String",
google_analytics_id: "String",
auto_relist: false,
can_installment: false,
max_installment_month: 0,
revert_previous_dns: false
}
Response
200
400
401
403
404
409
429
500
502

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
CLOSE_AUCTION Command
Support multi-thread
Require X-Signature
If calling the close_auction command, the following parameters should be included:
Request Parameters
Expand All
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
503
Service Unavailable
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/aftermarket/auctions/{auction_id}/close
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{}
Response
200
400
401
404
429
500
503

Structure
{
code: "Integer",
message: "String"
}
CREATE_EXPRESS_PAY_LINK Command
Support multi-thread
Require X-Signature
If calling the create_express_pay_link command, the following parameters should be included:
Request Parameters
Expand All
currency
String
domain_name
String
price
String
installment_enabled
Boolean
installment_months
String
Optional
link_expiration
String
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/aftermarket/pay_links
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
currency: "String",
domain_name: "String",
price: "String",
installment_enabled: false,
installment_months: "String",
link_expiration: "String"
}
Response
200
400
401
403
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
GET_EXPRESS_PAY_LINK Command
Support multi-thread
Require X-Signature
If calling the get_express_pay_link command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
pay_link_info
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/aftermarket/pay_links/{domain_name}
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
LIST_EXPRESS_PAY_LINK Command
Support multi-thread
Require X-Signature
If calling the list_express_pay_link command, the following parameters should be included:
Request Parameters
Expand All
status
String
Optional
page
Integer
Optional
page_size
Integer
Optional
Result Parameters
Expand All
pay_link_info_list
List
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/aftermarket/pay_links
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
DELETE_EXPRESS_PAY_LINK Command
Support multi-thread
Require X-Signature
If calling the delete_express_pay_link command, the following parameters should be included:
Request Parameters
Expand All
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
DELETE
https://api.dynadot.com/restful/v2/aftermarket/pay_links/{domain_name}
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String"
}
GET_LISTINGS Command
Support multi-thread
If calling the get_listings command, the following parameters should be included:
Request Parameters
Expand All
currency
String
exclude_pending_sale
Boolean
Optional
show_other_registrar
Boolean
Optional
page_size
Integer
page
Integer
Result Parameters
Expand All
listing_item_list
List
total
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
429
Too many requests
500
Internal Server Error
503
Service Unavailable
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/aftermarket/listings
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
429
500
503

Structure
{
code: "Integer",
message: "String",
data: {2 items}
}
GET_EXPIRED_CLOSEOUT_DOMAINS Command
Support multi-thread
If calling the get_expired_closeout_domains command, the following parameters should be included:
Request Parameters
Expand All
tld_type
String
Optional
currency
String
Optional
page
Integer
Optional
page_size
Integer
Optional
Result Parameters
Expand All
closeout_item_list
List
Error Code
Expand All
400
Bad Request
401
Unauthorized
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/aftermarket/get_expired_closeout_domains
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
GET_AFTERNIC_DOMAIN Command
Support multi-thread
If calling the get_afternic_domain command, the following parameters should be included:
Request Parameters
Expand All
domain_name
String
tlds
List
Optional
max_result
Integer
currency
String
Optional
Result Parameters
Expand All
afternic_domain_list
List
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/aftermarket/get_afternic_domain
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
GET_SEDO_DOMAIN Command
Support multi-thread
If calling the get_sedo_domain command, the following parameters should be included:
Request Parameters
Expand All
domain_name
String
tlds
List
Optional
max_result
Integer
currency
String
Optional
Result Parameters
Expand All
sedo_domain_list
List
Error Code
Expand All
400
Bad Request
404
Not Found
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/aftermarket/get_sedo_domain
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
404
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
LISTING_ON_AFTERNIC Command
Support multi-thread
Require X-Signature
If calling the listing_on_afternic command, the following parameters should be included:
Request Parameters
Expand All
domain_name
String
usd_price
String
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/aftermarket/listing_on_afternic
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
domain_name: "String",
usd_price: "String"
}
Response
200
400
401
403
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
LISTING_ON_SEDO Command
Support multi-thread
Require X-Signature
If calling the listing_on_sedo command, the following parameters should be included:
Request Parameters
Expand All
domain_name
String
price
String
currency
String
accept_sedo_agreement
Boolean
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/aftermarket/listing_on_sedo
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
domain_name: "String",
price: "String",
currency: "String",
accept_sedo_agreement: false
}
Response
200
400
401
403
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
BUY_AFTERNIC_DOMAIN Command
Support multi-thread
Require X-Signature
If calling the buy_afternic_domain command, the following parameters should be included:
Request Parameters
Expand All
domain_name
String
currency
String
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/aftermarket/buy_afternic_domain
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
domain_name: "String",
currency: "String"
}
Response
200
400
401
403
404
500

Structure
{
code: "Integer",
message: "String"
}
BUY_SEDO_DOMAIN Command
Support multi-thread
Require X-Signature
If calling the buy_sedo_domain command, the following parameters should be included:
Request Parameters
Expand All
domain_name
String
currency
String
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/aftermarket/buy_sedo_domain
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
domain_name: "String",
currency: "String"
}
Response
200
400
401
403
404
500

Structure
{
code: "Integer",
message: "String"
}
OTHER_REGISTRAR_DOMAIN_VERIFICATION Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the other_registrar_domain_verification command, the following parameters should be included:
Request Parameters
Expand All
new_key
Boolean
Optional
Result Parameters
Expand All
domain_name
String
verify_status
String
open_market_key
String
nameserver_list
List
txt
String
cname
String
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/aftermarket/other_registrar/{domain_name}/verification
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {6 items}
}
VERIFY_OTHER_REGISTRAR_DOMAIN Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the verify_other_registrar_domain command, the following parameters should be included:
Request Parameters
Expand All
domain_name_list
List
Result Parameters
Expand All
success_list
List
failed_list
List
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/aftermarket/other_registrar/verify
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
domain_name_list: [1 item]
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {2 items}
}
OTHER_REGISTRAR_DOMAIN_LIST Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the other_registrar_domain_list command, the following parameters should be included:
Request Parameters
Expand All
page_size
Integer
Optional
page
Integer
Optional
Result Parameters
Expand All
domain_info_list
List
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/aftermarket/other_registrar/domains
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
ADD_OTHER_REGISTRAR_DOMAIN Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the add_other_registrar_domain command, the following parameters should be included:
Request Parameters
Expand All
domain_name_list
List
Error Code
Expand All
400
Bad Request
401
Unauthorized
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/aftermarket/other_registrar/domains
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
domain_name_list: [1 item]
}
Response
200
400
401
429
500

Structure
{
code: "Integer",
message: "String"
}
LISTING_OTHER_REGISTRAR_DOMAIN Command
Support multi-thread
Require X-Signature
If calling the listing_other_registrar_domain command, the following parameters should be included:
Request Parameters
Expand All
for_sale_type
String
currency
String
Optional
listing_type
String
Optional
buy_now_price
Long
Optional
asking_price
Long
Optional
reserve_price
Long
Optional
minimum_offer_price
Long
Optional
installment
Boolean
Optional
maximum_installments
Integer
Optional
category
String
Optional
sub_category
String
Optional
description
String
Optional
google_analytics_id
String
Optional
use_for_sale_landing_page
Boolean
Optional
display_traffic
Boolean
Optional
display_more_listings
Boolean
Optional
display_trustpilot
Boolean
Optional
theme
String
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/aftermarket/{domain_name}/listing_other_registrar_domain
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
for_sale_type: "String",
currency: "String",
listing_type: "String",
buy_now_price: 0,
asking_price: 0,
reserve_price: 0,
minimum_offer_price: 0,
installment: false,
maximum_installments: 0,
category: "String",
sub_category: "String",
description: "String",
google_analytics_id: "String",
use_for_sale_landing_page: false,
display_traffic: false,
display_more_listings: false,
display_trustpilot: false,
theme: "String"
}
Response
200
400
401
403
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
BACKORDER_LIST Command
Support multi-thread
Require X-Signature
If calling the backorder_list command, the following parameters should be included:
Request Parameters
Expand All
currency
String
Optional
tlds
String
Optional
page
Integer
Optional
page_size
Integer
Optional
Result Parameters
Expand All
backorder_item_list
List
total
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
503
Service Unavailable
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/aftermarket/backorders
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500
503

Structure
{
code: "Integer",
message: "String",
data: {2 items}
}
GET_SITE_BUILDER Command
Support multi-thread
Require X-Signature
If calling the get_site_builder command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
sitebuilder
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/sitebuilders/{domain_name}
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
LIST_SITE_BUILDER Command
Support multi-thread
Require X-Signature
If calling the list_site_builder command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
sitebuilder_list
List
Error Code
Expand All
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/sitebuilders
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
CREATE_SITE_BUILDER Command
Support multi-thread
Require X-Signature
If calling the create_site_builder command, the following parameters should be included:
Request Parameters
Expand All
set_domain_dns
Boolean
Optional
Result Parameters
Expand All
sitebuilder
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/sitebuilders/{domain_name}
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
set_domain_dns: false
}
Response
200
400
401
403
404
409
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
UPGRADE_SITE_BUILDER Command
Support multi-thread
Require X-Signature
If calling the upgrade_site_builder command, the following parameters should be included:
Request Parameters
Expand All
set_domain_dns
Boolean
Optional
Result Parameters
Expand All
sitebuilder
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/sitebuilders/{domain_name}/upgrade
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
set_domain_dns: false
}
Response
200
400
401
403
404
409
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
DELETE_EMAIL_HOSTING Command
Support multi-thread
Require X-Signature
If calling the delete_email_hosting command, the following parameters should be included:
Request Parameters
Expand All
domain_name
String
Optional
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
DELETE
https://api.dynadot.com/restful/v2/email_hosting/{domain_name}
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String"
}
LIST_EMAIL_HOSTING Command
Support multi-thread
Require X-Signature
If calling the list_email_hosting command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
email_hosting_list
List
Error Code
Expand All
401
Unauthorized
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/email_hosting
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Response
200
401
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
CREATE_EMAIL_HOSTING Command
Support multi-thread
Require X-Signature
If calling the create_email_hosting command, the following parameters should be included:
Request Parameters
Expand All
domain_name
String
email_name
String
username
String
password
String
advanced_plan
Boolean
Optional
Result Parameters
Expand All
email_hosting
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/email_hosting
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
domain_name: "String",
email_name: "String",
username: "String",
password: "String",
advanced_plan: false
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
UPGRADE_EMAIL_HOSTING Command
Support multi-thread
Require X-Signature
If calling the upgrade_email_hosting command, the following parameters should be included:
Request Parameters
Expand All
domain_name
String
Optional
currency
String
Optional
Result Parameters
Expand All
email_hosting
Object
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
POST
https://api.dynadot.com/restful/v2/email_hosting/{domain_name}/upgrade
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
domain_name: "String",
currency: "String"
}
Response
200
400
401
404
409
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
LIST_COUPONS Command
Support multi-thread
Support API Sandbox
If calling the list_coupons command, the following parameters should be included:
Request Parameters
Expand All
coupon_type
String
Result Parameters
Expand All
coupons
List
Error Code
Expand All
400
Bad Request
401
Unauthorized
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://api.dynadot.com/restful/v2/orders/coupons
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
DOMAIN_GET_RESELLER_HOLD_STATUS Command
Support multi-thread
Support API Sandbox
If calling the domain_get_reseller_hold_status command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
domain_name
String
hold_status
Boolean
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://reseller-api.dynadot.com/restful/v2/domains/{domain_name}/reseller_hold_status
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
403
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {2 items}
}
DOMAIN_SET_RESELLER_HOLD_STATUS Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the domain_set_reseller_hold_status command, the following parameters should be included:
Request Parameters
Expand All
hold_status
Boolean
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
409
Conflict
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://reseller-api.dynadot.com/restful/v2/domains/{domain_name}/reseller_hold_status
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
hold_status: false
}
Response
200
400
401
403
404
409
429
500

Structure
{
code: "Integer",
message: "String"
}
DOMAIN_GET_CUSTOMER_ID Command
Support multi-thread
Support API Sandbox
If calling the domain_get_customer_id command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
customer_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://reseller-api.dynadot.com/restful/v2/domains/{domain_name}/customer_id
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
403
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
DOMAIN_SET_CUSTOMER_ID Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the domain_set_customer_id command, the following parameters should be included:
Request Parameters
Expand All
customer_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://reseller-api.dynadot.com/restful/v2/domains/{domain_name}/customer_id
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
customer_id: 0
}
Response
200
400
401
403
404
429
500

Structure
{
code: "Integer",
message: "String"
}
CONTACT_GET_OPT_OUT_OF_60_DAY_TRANSFER_LOCK Command
Support multi-thread
Support API Sandbox
If calling the contact_get_opt_out_of_60_day_transfer_lock command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
opt_out_of_60_day_transfer_lock
Boolean
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://reseller-api.dynadot.com/restful/v2/contacts/{contact_id}/opt_out_of_60_day_transfer_lock
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
403
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
CONTACT_SET_OPT_OUT_OF_60_DAY_TRANSFER_LOCK Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the contact_set_opt_out_of_60_day_transfer_lock command, the following parameters should be included:
Request Parameters
Expand All
opt_out_of_60_day_transfer_lock
Boolean
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://reseller-api.dynadot.com/restful/v2/contacts/{contact_id}/opt_out_of_60_day_transfer_lock
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
opt_out_of_60_day_transfer_lock: false
}
Response
200
400
401
403
404
429
500

Structure
{
code: "Integer",
message: "String"
}
CONTACT_GET_CUSTOMER_ID Command
Support multi-thread
Support API Sandbox
If calling the contact_get_customer_id command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
customer_id
Long
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://reseller-api.dynadot.com/restful/v2/contacts/{contact_id}/customer_id
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
403
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
CONTACT_SET_CUSTOMER_ID Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the contact_set_customer_id command, the following parameters should be included:
Request Parameters
Expand All
customer_id
Long
Error Code
Expand All
400
Bad Request
401
Unauthorized
403
Forbidden
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://reseller-api.dynadot.com/restful/v2/contacts/{contact_id}/customer_id
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
customer_id: 0
}
Response
200
400
401
403
404
429
500

Structure
{
code: "Integer",
message: "String"
}
CONTACT_GET_WHOIS_VERIFICATION_STATUS Command
Support multi-thread
Support API Sandbox
If calling the contact_get_whois_verification_status command, the following parameters should be included:
Request Parameters
Expand All
Result Parameters
Expand All
status
String
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
GET
https://reseller-api.dynadot.com/restful/v2/contacts/{contact_id}/get_whois_verification_status
Accept: application/json
Authorization: Bearer API_KEY
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
CONTACT_SET_WHOIS_VERIFICATION_STATUS Command
Support multi-thread
Support API Sandbox
Require X-Signature
If calling the contact_set_whois_verification_status command, the following parameters should be included:
Request Parameters
Expand All
contact_email
String
contact_has_been_verified_and_confirmed
Boolean
confirmed_ip
String
Result Parameters
Expand All
contact_id
Integer
Error Code
Expand All
400
Bad Request
401
Unauthorized
404
Not Found
429
Too many requests
500
Internal Server Error
Api Request and Header

Production

JSON
PUT
https://reseller-api.dynadot.com/restful/v2/contacts/{contact_id}/set_whois_verification_status
Content-Type: application/json
Accept: application/json
Authorization: Bearer API_KEY
X-Signature: {signature}
Request Body
{
contact_email: "String",
contact_has_been_verified_and_confirmed: false,
confirmed_ip: "String"
}
Response
200
400
401
404
429
500

Structure
{
code: "Integer",
message: "String",
data: {1 item}
}
ORDER_COMPLETED
If the order_completed event triggered, the data will contain the following parameters:
Request Parameters
Expand All
order_id
Integer
submitted_date
Long
currency
String
total_cost
String
total_paid
String
payment_method
String
status
String
order_item_list
List
Webhook Request Header
Content-Type: application/json
Authorization: Bearer WEBHOOK_KEY
X-Signature: {signature}
Request Body
{
event: "String",
event_id: "Integer",
timestamp: "Long",
data: {8 items}
}
DOMAIN_TRANSFER_AWAY
If the domain_transfer_away event triggered, the data will contain the following parameters:
Request Parameters
Expand All
domain
String
gaining_registrar
String
order_id
String
Webhook Request Header
Content-Type: application/json
Authorization: Bearer WEBHOOK_KEY
X-Signature: {signature}
Request Body
{
event: "String",
event_id: "Integer",
timestamp: "Long",
data: {3 items}
}
DOMAIN_EXPIRING
If the domain_expiring event triggered, the data will contain the following parameters:
Request Parameters
Expand All
domains_expired_after_30_days
String
domains_expired_after_10_days
String
domains_expired_after_3_days
String
domains_expired_today
String
domains_redemption
String
Webhook Request Header
Content-Type: application/json
Authorization: Bearer WEBHOOK_KEY
X-Signature: {signature}
Request Body
{
event: "String",
event_id: "Integer",
timestamp: "Long",
data: {5 items}
}
ACCOUNT_BALANCE_REMINDER
If the account_balance_reminder event triggered, the data will contain the following parameters:
Request Parameters
Expand All
balance_list
List
Webhook Request Header
Content-Type: application/json
Authorization: Bearer WEBHOOK_KEY
X-Signature: {signature}
Request Body
{
event: "String",
event_id: "Integer",
timestamp: "Long",
data: {1 item}
}
WHOIS_VERIFICATION_REQUIRED
If the whois_verification_required event triggered, the data will contain the following parameters:
Request Parameters
Expand All
whois_name
String
contact_id
Integer
verify_link
String
verify_end_time
String
domain_list
List
Webhook Request Header
Content-Type: application/json
Authorization: Bearer WEBHOOK_KEY
X-Signature: {signature}
Request Body
{
event: "String",
event_id: "Integer",
timestamp: "Long",
data: {5 items}
}
WHOIS_VERIFICATION_NOTIFICATION
If the whois_verification_notification event triggered, the data will contain the following parameters:
Request Parameters
Expand All
contact_id
Integer
verification_message
String
domain_list
List
Webhook Request Header
Content-Type: application/json
Authorization: Bearer WEBHOOK_KEY
X-Signature: {signature}
Request Body
{
event: "String",
event_id: "Integer",
timestamp: "Long",
data: {3 items}
}
ORDER_PAYMENT_REQUIRED
If the order_payment_required event triggered, the data will contain the following parameters:
Request Parameters
Expand All
order_id
Integer
submitted_date
Long
currency
String
total_cost
String
total_paid
String
payment_method
String
status
String
order_item_list
List
Webhook Request Header
Content-Type: application/json
Authorization: Bearer WEBHOOK_KEY
X-Signature: {signature}
Request Body
{
event: "String",
event_id: "Integer",
timestamp: "Long",
data: {8 items}
}
DOMAIN_STATUS_CHANGED
If the domain_status_changed event triggered, the data will contain the following parameters:
Request Parameters
Expand All
domain
String
change_type
String
expiration
Long
status
String
Webhook Request Header
Content-Type: application/json
Authorization: Bearer WEBHOOK_KEY
X-Signature: {signature}
Request Body
{
event: "String",
event_id: "Integer",
timestamp: "Long",
data: {4 items}
}
DOMAIN_SUSPENSION_STATUS_CHANGED
If the domain_suspension_status_changed event triggered, the data will contain the following parameters:
Request Parameters
Expand All
domain
String
suspended
Boolean
suspension_type
String
Optional
reason
String
message
String
Optional
status_changed_timestamp
Long
Webhook Request Header
Content-Type: application/json
Authorization: Bearer WEBHOOK_KEY
X-Signature: {signature}
Request Body
{
event: "String",
event_id: "Integer",
timestamp: "Long",
data: {6 items}
}
MAINTENANCE_NOTICE
If the maintenance_notice event triggered, the data will contain the following parameters:
Request Parameters
Expand All
start_time
Long
end_time
Long
available_services
String
unavailable_services
String
registry_name
String
affected_tlds
String
Webhook Request Header
Content-Type: application/json
Authorization: Bearer WEBHOOK_KEY
X-Signature: {signature}
Request Body
{
event: "String",
event_id: "Integer",
timestamp: "Long",
data: {6 items}
}
CONTACT_KYC_STATUS_CHANGED
If the contact_kyc_status_changed event triggered, the data will contain the following parameters:
Request Parameters
Expand All
contact_id
Integer
kyc_audit_status
String
The kyc status for this contact .
Supported values
not_started : { Not Started }
action_required : { Action Required }
approved : { Approved }
rejected : { Rejected }
in_review : { In Review }
expired : { Expired }
message
String
verify_date
Long
failure
Object
Optional
verifications
Object
Optional
Webhook Request Header
Content-Type: application/json
Authorization: Bearer WEBHOOK_KEY
X-Signature: {signature}
Request Body
{
event: "String",
event_id: "Integer",
timestamp: "Long",
data: {6 items}
}








Newsletter sign-up
Enter email
Submit
Download the app:
Domains
Domain Search
Transfer
IDNs Search
TLD Prices
Domain Sales
Resellers
Websites
Email
SSL
Domain Suggestion Tool
Security
Grace Deletion
API
Whois Lookup
Payment Plan
Aftermarket
Aftermarket Search
Market Overview
User Listings
Backorders
Expired Auctions
User Auctions
Backorder Auctions
Last Chance Auctions
Expired Closeout
NameClub Beta
Support
Blog
Help Files
Forums
Buying Domains
Selling Domains
Newsletter
Prepay
Payment Options
Report Abuse
Dynadot
About
Contact
Events
Site Map
APP
Refer-a-friend
Affiliate
Copyright © 2002-2026 Dynadot Inc. All rights reserved.
Privacy Policy
Terms of Use
Registrant Educational Information
Registrants Benefits and Responsibilities
