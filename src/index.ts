function _registerEvent(target: any, eventType: string, cb: Fn) {
    if (target.addEventListener) {
        target.addEventListener(eventType, cb);
        return {
            remove: function () {
                target.removeEventListener(eventType, cb);
            },
        };
    } else {
        target.attachEvent(eventType, cb);
        return {
            remove: function () {
                target.detachEvent(eventType, cb);
            },
        };
    }
}

function _createHiddenIframe(target: HTMLElement, uri: string) {
    var iframe = document.createElement('iframe');
    iframe.src = uri;
    iframe.id = 'hiddenIframe';
    iframe.style.display = 'none';
    target.appendChild(iframe);

    return iframe;
}

function openUriWithHiddenFrame(uri: string, failCb: Fn, successCb: Fn) {
    var timeout = setTimeout(function () {
        failCb();
        handler.remove();
    }, 1000);

    var iframe = document.querySelector('#hiddenIframe') as HTMLIFrameElement;
    if (!iframe) {
        iframe = _createHiddenIframe(document.body, 'about:blank');
    }

    var handler = _registerEvent(window, 'blur', onBlur);

    function onBlur() {
        clearTimeout(timeout);
        handler.remove();
        successCb();
    }

    iframe.contentWindow!.location.href = uri;
}

function openUriWithTimeoutHack(uri: string, failCb: Fn, successCb: Fn) {
    var timeout = setTimeout(function () {
        failCb();
        handler.remove();
    }, 1000);

    // handle page running in an iframe (blur must be registered with top level window)
    var target = window;
    /* while (target != target.parent) {
              target = target.parent;
          }*/
    var handler = _registerEvent(target, 'blur', onBlur);

    function onBlur() {
        clearTimeout(timeout);
        handler.remove();
        successCb();
    }

    window.location.href = uri;
}

function openUriUsingFirefox(uri: string, failCb: Fn, successCb: Fn) {
    var iframe = document.querySelector('#hiddenIframe') as HTMLIFrameElement;

    if (!iframe) {
        iframe = _createHiddenIframe(document.body, 'about:blank');
    }

    try {
        iframe.contentWindow!.location.href = uri;
        successCb();
    } catch (e) {
        if (e.name === 'NS_ERROR_UNKNOWN_PROTOCOL') {
            failCb();
        }
    }
}

function openUriUsingIEInOlderWindows(uri: string, failCb: Fn, successCb: Fn) {
    if (getInternetExplorerVersion() === 10) {
        openUriUsingIE10InWindows7(uri, failCb, successCb);
    } else if (
        getInternetExplorerVersion() === 9 ||
        getInternetExplorerVersion() === 11
    ) {
        openUriWithHiddenFrame(uri, failCb, successCb);
    } else {
        openUriInNewWindowHack(uri, failCb, successCb);
    }
}

function openUriUsingIE10InWindows7(uri: string, failCb: Fn, successCb: Fn) {
    var timeout = setTimeout(failCb, 1000);
    window.addEventListener('blur', function () {
        clearTimeout(timeout);
        successCb();
    });

    var iframe = document.querySelector('#hiddenIframe') as HTMLIFrameElement;
    if (!iframe) {
        iframe = _createHiddenIframe(document.body, 'about:blank');
    }
    try {
        iframe.contentWindow!.location.href = uri;
    } catch (e) {
        failCb();
        clearTimeout(timeout);
    }
}

function openUriInNewWindowHack(uri: string, failCb?: Fn, successCb?: Fn) {
    const myWindow = window.open('', '', 'width=0,height=0');

    if (!myWindow) {
        return;
    }

    myWindow.document.write("<iframe src='" + uri + "'></iframe>");

    setTimeout(function () {
        try {
            myWindow.location.href;
            myWindow.setTimeout('window.close()', 1000);
            successCb && successCb();
        } catch (e) {
            myWindow.close();
            failCb && failCb();
        }
    }, 1000);
}

function openUriWithMsLaunchUri(uri: string, failCb: Fn, successCb: Fn) {
    navigator.msLaunchUri(uri, successCb, failCb);
}

function checkBrowser() {
    // @ts-ignore
    const isOpera = !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
    const ua = navigator.userAgent.toLowerCase();
    return {
        isOpera: isOpera,
        // @ts-ignore
        isFirefox: typeof InstallTrigger !== 'undefined',
        isSafari:
            (~ua.indexOf('safari') && !~ua.indexOf('chrome')) ||
            Object.prototype.toString
                .call(window.HTMLElement)
                .indexOf('Constructor') > 0,
        isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream,
        // @ts-ignore
        isChrome: !!window.chrome && !isOpera,
        isIE: ua.indexOf('IE') != -1,
    };
}

function getInternetExplorerVersion() {
    var rv = -1;
    if (navigator.appName === 'Microsoft Internet Explorer') {
        var ua = navigator.userAgent;
        var re = new RegExp('MSIE ([0-9]{1,}[.0-9]{0,})');
        if (re.exec(ua) != null) {
            rv = parseFloat(RegExp.$1);
        }
    } else if (navigator.appName === 'Netscape') {
        ua = navigator.userAgent;
        re = new RegExp('Trident/.*rv:([0-9]{1,}[.0-9]{0,})');
        if (re.exec(ua) != null) {
            rv = parseFloat(RegExp.$1);
        }
    }
    return rv;
}

function isFunction(value: any) {
    return typeof value === 'function';
}

export default function protocolCheck(
    uri: string,
    failCb: Fn,
    successCb: Fn,
    unsupportedCb?: Fn
) {
    function failCallback() {
        failCb && failCb();
    }

    function successCallback() {
        successCb && successCb();
    }

    if (isFunction(navigator.msLaunchUri)) {
        openUriWithMsLaunchUri(uri, failCb, successCb);
    } else {
        var browser = checkBrowser();

        if (browser.isFirefox) {
            openUriUsingFirefox(uri, failCallback, successCallback);
        } else if (browser.isChrome || browser.isIOS) {
            openUriWithTimeoutHack(uri, failCallback, successCallback);
        } else if (browser.isIE) {
            openUriUsingIEInOlderWindows(uri, failCallback, successCallback);
        } else if (browser.isSafari) {
            openUriWithHiddenFrame(uri, failCallback, successCallback);
        } else {
            unsupportedCb && unsupportedCb();
        }
    }
}
