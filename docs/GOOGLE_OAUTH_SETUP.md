# Google student sign-in setup

The current sign-in page starts a server-side Google OAuth code flow. The API
will intentionally return **Google login is not configured** until the required
credentials are present in aplus-ict-api/.env.

## Local development

1. In Google Cloud Console, create or choose the project for A Plus ICT.
2. Configure the OAuth consent screen and add the Google accounts allowed to
   test the application while it is in testing mode.
3. Create an OAuth client with application type **Web application**.
4. Add this exact authorised redirect URI:

   ~~~
   http://localhost:4000/api/v1/auth/google/callback
   ~~~

5. Copy the client ID and client secret into aplus-ict-api/.env:

   ~~~dotenv
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:4000/api/v1/auth/google/callback
WEB_LOGIN_SUCCESS_URL=http://localhost:5173/login/success
   ~~~

6. Restart the API process, then open the Web site at
   http://localhost:5173 and choose **Continue with Google**.

## Production

Create or update the same Web client with the public HTTPS callback, for
example:

~~~
https://api.example.com/api/v1/auth/google/callback
~~~

Set that exact value as GOOGLE_CALLBACK_URL, set WEB_LOGIN_SUCCESS_URL to the
production Web application's /login/success page, and include the production
Web origin in CORS_ORIGINS.

Keep .env and the Google client secret out of source control. Google verifies
redirect URIs exactly, including protocol, host, port, path, and trailing slash.
