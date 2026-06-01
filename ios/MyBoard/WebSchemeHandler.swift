import Foundation
import WebKit

/// Serves the bundled web app (`index.html`, `*.jsx`, `styles.css`, `vendor/`) over a
/// custom `app://board/` scheme.
///
/// We deliberately avoid `file://`: the web app's CLAUDE.md notes that Gist sync and
/// reliable script loading need a real HTTP-like origin (which is why the dev workflow
/// is `python3 -m http.server`). A `WKURLSchemeHandler` gives the page a stable origin,
/// so `localStorage` (the board's entire datastore) persists and the in-browser Babel
/// loader fetches the `.jsx` files exactly as it does in a browser. This is the same
/// technique Capacitor uses for its `capacitor://localhost` origin.
final class WebSchemeHandler: NSObject, WKURLSchemeHandler {

    static let scheme = "app"
    static let host = "board"
    static var baseURL: URL { URL(string: "\(scheme)://\(host)/")! }

    /// Root of the copied web assets inside the app bundle. The "Copy Web Assets" build
    /// phase mirrors the repo's web files into `<Resources>/web/`.
    private let webRoot: URL = Bundle.main.resourceURL!.appendingPathComponent("web", isDirectory: true)

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        // Map the request path to a file under webRoot; "/" serves index.html.
        var relativePath = url.path
        if relativePath.isEmpty || relativePath == "/" {
            relativePath = "/index.html"
        }
        let decoded = relativePath.removingPercentEncoding ?? relativePath
        let fileURL = webRoot.appendingPathComponent(decoded).standardizedFileURL

        // Refuse anything that escapes the web root (path traversal) or is missing.
        guard fileURL.path.hasPrefix(webRoot.standardizedFileURL.path),
              let data = try? Data(contentsOf: fileURL) else {
            respondNotFound(to: urlSchemeTask, url: url)
            return
        }

        let headers = [
            "Content-Type": Self.mimeType(for: fileURL.pathExtension),
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*"
        ]
        guard let response = HTTPURLResponse(url: url, statusCode: 200,
                                             httpVersion: "HTTP/1.1", headerFields: headers) else {
            respondNotFound(to: urlSchemeTask, url: url)
            return
        }
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // All work is synchronous within start(_:), so there is nothing to cancel.
    }

    private func respondNotFound(to task: WKURLSchemeTask, url: URL) {
        guard let response = HTTPURLResponse(url: url, statusCode: 404,
                                             httpVersion: "HTTP/1.1", headerFields: nil) else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        task.didReceive(response)
        task.didReceive(Data())
        task.didFinish()
    }

    private static func mimeType(for ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm": return "text/html; charset=utf-8"
        case "css":         return "text/css; charset=utf-8"
        case "js", "mjs":   return "text/javascript; charset=utf-8"
        case "jsx":         return "text/babel; charset=utf-8"
        case "json":        return "application/json; charset=utf-8"
        case "woff2":       return "font/woff2"
        case "woff":        return "font/woff"
        case "ttf":         return "font/ttf"
        case "svg":         return "image/svg+xml"
        case "png":         return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "ico":         return "image/x-icon"
        default:            return "application/octet-stream"
        }
    }
}
