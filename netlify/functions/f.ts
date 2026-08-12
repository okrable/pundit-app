import { withLambda, type LambdaHandler } from '@netlify/aws-lambda-compat';

// Web URL handler for friend invite links
// URL format: /f/{CODE}
// This returns an HTML page that attempts to open the app via deep link,
// with a fallback UI if the app isn't installed.

const handler: LambdaHandler = async (event) => {
  const htmlHeaders: Record<string, string> = {
    'Content-Type': 'text/html',
    'Cache-Control': 'no-cache',
  };

  // Extract the code from the path
  // The path will be like /.netlify/functions/f/ABCD1234
  const pathParts = event.path.split('/');
  const code = pathParts[pathParts.length - 1];

  if (!code || code === 'f') {
    return {
      statusCode: 400,
      headers: htmlHeaders,
      body: generateErrorPage('Invalid invite link'),
    };
  }

  const deepLink = `pundit-app://add-friend/${code}`;
  const appStoreUrl = 'https://apps.apple.com/app/pundit-trivia'; // Replace with actual App Store URL
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.pundit.trivia'; // Replace with actual Play Store URL

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Join My Pundit Leaderboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #F9F6ED;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 24px;
      padding: 40px 32px;
      max-width: 360px;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    }
    .icon {
      width: 64px;
      height: 64px;
      background: #34855b;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    .icon svg {
      width: 32px;
      height: 32px;
      fill: white;
    }
    h1 {
      color: #2f2926;
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #8E8E93;
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .code-container {
      background: #F9F6ED;
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .code-label {
      color: #8E8E93;
      font-size: 12px;
      margin-bottom: 8px;
    }
    .code {
      color: #34855b;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 4px;
    }
    .open-app-btn {
      background: #34855b;
      color: white;
      border: none;
      border-radius: 12px;
      padding: 16px 32px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      margin-bottom: 16px;
      text-decoration: none;
      display: block;
    }
    .open-app-btn:hover {
      background: #2d7350;
    }
    .store-links {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-top: 16px;
    }
    .store-link {
      color: #34855b;
      font-size: 14px;
      text-decoration: none;
    }
    .store-link:hover {
      text-decoration: underline;
    }
    .fallback-text {
      color: #8E8E93;
      font-size: 12px;
      margin-top: 16px;
    }
    .loading {
      display: none;
    }
    .show-fallback .loading {
      display: none;
    }
    .show-fallback .fallback {
      display: block;
    }
    .fallback {
      display: none;
    }
  </style>
</head>
<body>
  <div class="container" id="container">
    <div class="icon">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M16.5 13c-1.2 0-3.07.34-4.5 1-1.43-.67-3.3-1-4.5-1C5.33 13 1 14.08 1 16.25V19h22v-2.75c0-2.17-4.33-3.25-6.5-3.25zm-4 4.5h-10v-1.25c0-.54 2.56-1.75 5-1.75s5 1.21 5 1.75v1.25zm9 0H14v-1.25c0-.46-.2-.86-.52-1.22.88-.3 1.96-.53 3.02-.53 2.44 0 5 1.21 5 1.75v1.25zM7.5 12c1.93 0 3.5-1.57 3.5-3.5S9.43 5 7.5 5 4 6.57 4 8.5 5.57 12 7.5 12zm0-5.5c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 5.5c1.93 0 3.5-1.57 3.5-3.5S18.43 5 16.5 5 13 6.57 13 8.5s1.57 3.5 3.5 3.5zm0-5.5c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/>
      </svg>
    </div>
    <h1>Join My Leaderboard</h1>
    <p class="subtitle">Someone invited you to compete on their Pundit leaderboard!</p>

    <div class="code-container">
      <div class="code-label">Your Invite Code</div>
      <div class="code">${code}</div>
    </div>

    <div id="loading" class="loading">
      <p class="subtitle">Opening Pundit app...</p>
    </div>

    <div id="fallback" class="fallback">
      <a href="${deepLink}" class="open-app-btn">Open in Pundit App</a>
      <p class="fallback-text">Don't have the app?</p>
      <div class="store-links">
        <a href="${appStoreUrl}" class="store-link">App Store</a>
        <span style="color: #8E8E93;">|</span>
        <a href="${playStoreUrl}" class="store-link">Google Play</a>
      </div>
    </div>
  </div>

  <script>
    // Try to open the app automatically
    var deepLink = "${deepLink}";
    var startTime = Date.now();
    var timeout = null;

    // Show fallback after a delay if we're still on this page
    timeout = setTimeout(function() {
      document.getElementById('fallback').style.display = 'block';
    }, 1500);

    // Try to open the deep link
    window.location.href = deepLink;

    // If we're still here after trying to open the app, the app isn't installed
    // The visibility change will happen if the app opens
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        clearTimeout(timeout);
      }
    });
  </script>
</body>
</html>`;

  return {
    statusCode: 200,
    headers: htmlHeaders,
    body: html,
  };
};

function generateErrorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error - Pundit</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #F9F6ED;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 24px;
      padding: 40px 32px;
      max-width: 360px;
      width: 100%;
      text-align: center;
    }
    h1 { color: #2f2926; font-size: 20px; margin-bottom: 8px; }
    p { color: #8E8E93; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Oops!</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

export default withLambda(handler);
