import UIKit
import WebKit

/// Hosts the whole web app in a full-screen WKWebView. The board manages its own
/// navigation/tabs inside React, so this controller only wires up the web view,
/// registers the `app://` scheme handler, and loads index.html once.
final class WebViewController: UIViewController {

    private var webView: WKWebView!

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(WebSchemeHandler(), forURLScheme: WebSchemeHandler.scheme)
        // Persistent store so localStorage survives across launches.
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        webView.scrollView.backgroundColor = .systemBackground
        // Let the scroll view inset content for the notch / home indicator automatically.
        webView.scrollView.contentInsetAdjustmentBehavior = .always
        webView.allowsBackForwardNavigationGestures = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        if #available(iOS 16.4, *) {
            webView.isInspectable = true  // enable Safari Web Inspector during development
        }

        self.webView = webView
        self.view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        let url = WebSchemeHandler.baseURL.appendingPathComponent("index.html")
        webView.load(URLRequest(url: url))
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .default }

    /// Open a link outside the web view (Safari / Mail / Phone, etc.).
    private func openExternally(_ url: URL) {
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
    }
}

// MARK: - Navigation

extension WebViewController: WKNavigationDelegate, WKUIDelegate {

    /// Keep in-app navigation on the bundled `app://` scheme; hand every external
    /// link (the board's Overleaf / GitHub / website / trip links, all `target="_blank"`)
    /// to the system so it opens in Safari — matching how they behave in a browser.
    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        if url.scheme == WebSchemeHandler.scheme {
            decisionHandler(.allow)
            return
        }

        // A user tapped an external link (or a target="_blank" link with no target frame).
        let isLink = navigationAction.navigationType == .linkActivated
        let isBlankTarget = navigationAction.targetFrame == nil
        if isLink || isBlankTarget {
            openExternally(url)
            decisionHandler(.cancel)
            return
        }

        decisionHandler(.allow)
    }

    /// `target="_blank"` links ask WebKit to create a new web view. We don't host one,
    /// so open the request externally and return nil.
    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, url.scheme != WebSchemeHandler.scheme {
            openExternally(url)
        }
        return nil
    }
}
