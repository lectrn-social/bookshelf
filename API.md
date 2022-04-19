## Authentication

### Scopes
NOTE: This is bound to be changed and overhauled.

 * `me` - Read profile
 * `me:write` - Change profile
 * `me:private` - Read private items on profile
 * `blips:write` - Create Blips
 * `feed:home` - Read home timeline
 * `feed:home:private` - Read private items on home timeline
 * `others` - Read other people's profiles
 * `others:private` - Read private items on other people's profiles
 * `account:admin` - Change account settings
 * `offline_access` - Refresh token

### `/oauth2/authorize`
Navigate user's browser here to get an authorization code.

Query parameters:
 * `response_type`: must be `code`
 * `client_id`: your app's Client ID
 * `redirect_uri`: the URI to redirect to with authentication results
 * `scope`: space-separated list of scopes
 * `code_challenge`: optional PKCE code challenge
 * `code_challenge_method`: optional PKCE code challenge method, must be `S256`
 * `state`: optional state to forward to redirect URI

Redirect URI's parameters:
 * `code`: result authorization code
 * `state`: specified state

### POST `/oauth2/token`
Turns codes into tokens.

Request body:
 * `grant_type`: must be `authorization_code`
 * `code`: authorization code
 * `redirect_uri`: must be the same as specified to `/oauth2/authorize`
 * `client_id`: must be the same as specified to `/oauth2/authorize`
 * `code_verifier`: optional PKCE code verifier

## User

### GET `/users/:user`
Returns a user

Scope: `me`/`others`

URL parameters:
 * `user`: User identifier. Can be a user ID, `@` + a username, or `me` to get the authenticated user

## Blip

### POST `/users/:user/blips`
Creates a Blip

Scope: `blips:write`

Request body:
 * `content`: text of blip
 * `contentWarning`: optional content warning shown before blip is shown
 * `audience`: optional Audience. will default to user's default

### GET `/users/:user/blips/:blip`
Returns a Blip

Scope: `me`/`others` (`:private`)

URL parameters:
 * `blip`: ID of Blip

### GET `/users/:user/blips`
Returns blips of user

Scope: `me`/`others` (`:private`)

Query parameters:
 * `count`: number of Blips to return. (min 1 max 50)
 * `from`: number of Blips to skip, used for pagination. (can be negative, will skip backwards from the end)
 * `privacy`: blip privacy filter, `public` or `private` (requires private scope)

## Feed

### GET `/users/:user/feeds/user`
Returns user feed

Scope: `me`/`others` (`:private`)

Query parameter:
 * `count`: number of items to return. (min 1 max 50)
 * `before`: return things older than this date, unix time in seconds, used for pagination
 * `privacy`: item privacy filter, `public` or `private` (requires private scope)

### GET `/users/:user/feeds/home`
Returns user feed

Scope: `feed:home` (`:private`)

Query parameter:
 * `count`: number of items to return. (min 1 max 50)
 * `before`: return things older than this date, unix time in seconds, used for pagination
 * `privacy`: item privacy filter, `public` or `private` (requires private scope)

