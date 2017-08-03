// Check to see if I am running this locally for dev mode
function isDevMode() {
    return !('update_url' in chrome.runtime.getManifest());
}

var server_url = 'something went wrong if this logs';
if (isDevMode()) {
    server_url = 'https://localhost:5000/linksforuser';
} else {
    server_url = 'https://tabmailer-174400.appspot.com/linksforuser';
}

function getCurrentTabUrl(callback) {
    var queryInfo = {
        active: true,
        currentWindow: true
    };
    chrome.tabs.query(queryInfo, function(tabs) {
        var tab = tabs[0];

        var url = tab.url;

        console.assert(typeof url == 'string', 'tab.url should be a string');

        var post_data = { tab_url: url };

        authenticatedXhr("POST", server_url, post_data, callback)
    });

}


function showNotification(title, message) {
    chrome.notifications.create(Math.rand, {
        type: 'basic',
        iconUrl: 'icon.png',
        title: title,
        message: message,
    }, function(notificationId) {});

}

function closeCurrentTab() {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function(tabs) {

        chrome.tabs.remove(tabs[0].id, function() {});
    });

}

function displayCompletionMessage(completion, tabURL) {
    if (completion === true) {
        showNotification('Complete!', 'Successfully added ' + tabURL + ' to your TabMailer queue!');
        closeCurrentTab();
    } else {
        showNotification('Error!', 'Failed to add the URL: ' + tabURL + ' to your TabMailer queue :(');
    }
};





// callback = function (error, httpStatus, responseText);
function authenticatedXhr(method, url, req_body, callback) {
    var retry = true;

    function getTokenAndXhr() {

        // for some reason the actual redirectMethod returns an additional /, which
        // Google Console does not like, despite me registering that as a redirect URL...
        var redirURL = 'https://hjckfmabbnhjkfejdmiecefhkbekkefe.chromiumapp.org';
        chrome.identity.launchWebAuthFlow({
                url: "https://accounts.google.com/o/oauth2/auth?client_id=881057203535-i7f0fqflce385r6u0p41nvseto0k8gbk.apps.googleusercontent.com&redirect_uri=" + redirURL + "&response_type=token&scope=https://www.googleapis.com/auth/userinfo.profile",
                interactive: true
            },
            function(redirect_url) {
                if (chrome.runtime.lastError) {
                    callback(chrome.runtime.lastError);
                    console.log(chrome.runtime.lastError);
                    return;
                }

                // As if this whole process wasn't a big enough pain in the ass,
                // this is C/P'd from SO because parsing this shit is not something I felt like doing
                // seriously FU google
                var access_token = new URL(redirect_url).hash.split('&').filter(function(el) { if (el.match('access_token') !== null) return true; })[0].split('=')[1];
                req_body['google_auth_token'] = access_token;

                var xhr = new XMLHttpRequest();
                xhr.open(method, url, true);
                xhr.setRequestHeader('Authorization',
                    'Bearer ' + access_token);
                xhr.setRequestHeader("Content-Type", "application/json");

                xhr.onload = function() {
                    if (this.status === 401 && retry) {
                        // This status may indicate that the cached
                        // access token was invalid. Retry once with
                        // a fresh token.
                        retry = false;
                        chrome.identity.removeCachedAuthToken({ 'token': access_token },
                            getTokenAndXhr);
                        return;
                    } else if (this.readyState == XMLHttpRequest.DONE && this.status == 200) {
                        callback(true, req_body['tab_url']);
                    } else if (this.readyState == XMLHttpRequest.DONE && this.status != 200) {
                        callback(false);
                    }
                }
                xhr.send(JSON.stringify(req_body));
            });
    }
    getTokenAndXhr();
}

chrome.browserAction.onClicked.addListener(function(tab) {

    getCurrentTabUrl(displayCompletionMessage);
});