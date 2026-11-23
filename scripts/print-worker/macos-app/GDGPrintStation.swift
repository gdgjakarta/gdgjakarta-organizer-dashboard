import AppKit
import CoreBluetooth
import CoreImage
import Foundation
import Network
import WebKit

let WORKER_VERSION = "2.5.0"
let DEFAULT_PORT: UInt16 = 17777
let DEFAULT_ORIGINS = [
    "https://gdgjakarta.com",
    "https://www.gdgjakarta.com",
    "https://app.gdgjakarta.org",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]

// MARK: - Configuration & Persistence

struct SavedBluetoothPrinter: Codable, Equatable {
    var id: String
    var name: String
    var enabled: Bool
}

struct WorkerConfig: Codable {
    var printers: [String]
    var port: Int
    var allowedOrigins: [String]
    var chromePath: String?
    var userConfiguredPrinters: Bool?
    var bluetoothPrinters: [SavedBluetoothPrinter]?
}

final class ConfigStore {
    static let shared = ConfigStore()
    let configDir: URL
    let configURL: URL

    private init() {
        let home = FileManager.default.homeDirectoryForCurrentUser
        self.configDir = home.appendingPathComponent(".gdg-print-worker")
        self.configURL = configDir.appendingPathComponent("config.json")
    }

    func load() -> WorkerConfig {
        if let data = try? Data(contentsOf: configURL),
           let decoded = try? JSONDecoder().decode(WorkerConfig.self, from: data) {
            var mergedOrigins = Set(decoded.allowedOrigins)
            for o in DEFAULT_ORIGINS { mergedOrigins.insert(o) }
            return WorkerConfig(
                printers: decoded.printers,
                port: (1024...65535).contains(decoded.port) ? decoded.port : Int(DEFAULT_PORT),
                allowedOrigins: Array(mergedOrigins).sorted(),
                chromePath: decoded.chromePath,
                userConfiguredPrinters: decoded.userConfiguredPrinters,
                bluetoothPrinters: decoded.bluetoothPrinters ?? []
            )
        }
        return WorkerConfig(
            printers: [],
            port: Int(DEFAULT_PORT),
            allowedOrigins: DEFAULT_ORIGINS,
            chromePath: nil,
            userConfiguredPrinters: false,
            bluetoothPrinters: []
        )
    }

    func save(_ config: WorkerConfig) {
        try? FileManager.default.createDirectory(at: configDir, withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        if let data = try? encoder.encode(config) {
            try? data.write(to: configURL, options: .atomic)
        }
    }
}

// MARK: - Shell & System Helpers

enum Shell {
    @discardableResult
    static func run(_ executable: String, _ args: [String], timeout: TimeInterval = 8.0) -> (code: Int32, stdout: String, stderr: String) {
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: executable)
        proc.arguments = args
        let outPipe = Pipe()
        let errPipe = Pipe()
        proc.standardOutput = outPipe
        proc.standardError = errPipe

        var outData = Data()
        var errData = Data()
        let group = DispatchGroup()

        group.enter()
        DispatchQueue.global(qos: .utility).async {
            outData = outPipe.fileHandleForReading.readDataToEndOfFile()
            group.leave()
        }

        group.enter()
        DispatchQueue.global(qos: .utility).async {
            errData = errPipe.fileHandleForReading.readDataToEndOfFile()
            group.leave()
        }

        do {
            try proc.run()
        } catch {
            return (-1, "", error.localizedDescription)
        }

        let deadline = Date().addingTimeInterval(timeout)
        while proc.isRunning && Date() < deadline {
            Thread.sleep(forTimeInterval: 0.015)
        }
        if proc.isRunning {
            proc.terminate()
            let killDeadline = Date().addingTimeInterval(0.3)
            while proc.isRunning && Date() < killDeadline {
                Thread.sleep(forTimeInterval: 0.015)
            }
            if proc.isRunning {
                kill(proc.processIdentifier, SIGKILL)
            }
        }
        proc.waitUntilExit()
        _ = group.wait(timeout: .now() + 1.0)

        let stdout = String(data: outData, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let stderr = String(data: errData, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return (proc.terminationStatus, stdout, stderr)
    }
}

struct DeviceIdentity {
    let id: String
    let computerName: String
    let model: String?
    let os: String

    static func resolve() -> DeviceIdentity {
        let cname = Shell.run("/usr/sbin/scutil", ["--get", "ComputerName"]).stdout
        let model = Shell.run("/usr/sbin/sysctl", ["-n", "hw.model"]).stdout
        let osVer = Shell.run("/usr/bin/sw_vers", ["-productVersion"]).stdout
        let ioregOut = Shell.run("/usr/sbin/ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"]).stdout
        var uuid = ""
        for line in ioregOut.components(separatedBy: "\n") {
            if line.contains("IOPlatformUUID") {
                let parts = line.components(separatedBy: "\"")
                if parts.count >= 4 {
                    uuid = parts[3].lowercased()
                    break
                }
            }
        }
        let resolvedName = cname.isEmpty ? (Host.current().localizedName ?? "Mac") : cname
        let rawId = uuid.isEmpty ? resolvedName.lowercased() : uuid
        let cleanId = rawId.replacingOccurrences(
            of: "[^a-z0-9_-]",
            with: "-",
            options: .regularExpression
        )
        return DeviceIdentity(
            id: "mac-\(cleanId.prefix(28))",
            computerName: resolvedName,
            model: model.isEmpty ? nil : model,
            os: osVer.isEmpty ? "macOS" : "macOS \(osVer)"
        )
    }
}

// MARK: - Legacy CLI Worker Cleanup

enum LegacyWorkerCleaner {
    static func cleanupPreviousInstallations(port: Int) {
        let myPid = ProcessInfo.processInfo.processIdentifier
        // 1. Stop any process currently listening on port 17777 that is not this process
        let lsof = Shell.run("/usr/sbin/lsof", ["-nP", "-iTCP:\(port)", "-sTCP:LISTEN", "-t"])
        if !lsof.stdout.isEmpty {
            for line in lsof.stdout.components(separatedBy: "\n") {
                if let pid = Int32(line.trimmingCharacters(in: .whitespaces)), pid > 0, pid != myPid {
                    kill(pid, SIGTERM)
                }
            }
            Thread.sleep(forTimeInterval: 0.25)
        }

        // 2. Unload legacy LaunchAgent if present and remove ~/.gdg-print-worker/bin
        let home = FileManager.default.homeDirectoryForCurrentUser
        let legacyPlist = home.appendingPathComponent("Library/LaunchAgents/org.gdgjakarta.print-worker.plist")
        if FileManager.default.fileExists(atPath: legacyPlist.path) {
            _ = Shell.run("/bin/launchctl", ["unload", legacyPlist.path])
            try? FileManager.default.removeItem(at: legacyPlist)
        }

        let legacyBinDir = home.appendingPathComponent(".gdg-print-worker/bin")
        if FileManager.default.fileExists(atPath: legacyBinDir.path) {
            try? FileManager.default.removeItem(at: legacyBinDir)
        }
    }
}

// MARK: - Notch & Floating Dynamic Island Live Activity HUD

enum HudPhase {
    case printing(attendee: String, printer: String, dimensions: String)
    case completed(attendee: String, printer: String)
    case failed(attendee: String, error: String)
}

@MainActor
final class NotchDynamicIslandController {
    static let shared = NotchDynamicIslandController()

    private var panel: NSPanel?
    private let containerView = NSView()
    private let badgeDot = NSView()
    private let titleLabel = NSTextField(labelWithString: "")
    private let subtitleLabel = NSTextField(labelWithString: "")
    private let pillContainer = NSView()
    private let pillTag = NSTextField(labelWithString: "")
    private var dismissWorkItem: DispatchWorkItem?

    private init() {}

    private func ensurePanel() {
        guard panel == nil else { return }

        let p = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 340, height: 48),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        p.isFloatingPanel = true
        p.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.statusWindow)) + 2)
        p.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]
        p.backgroundColor = .clear
        p.isOpaque = false
        p.hasShadow = true
        p.ignoresMouseEvents = true

        containerView.wantsLayer = true
        containerView.layer?.backgroundColor = NSColor.black.withAlphaComponent(0.95).cgColor
        containerView.layer?.borderColor = NSColor.white.withAlphaComponent(0.16).cgColor
        containerView.layer?.borderWidth = 1.0

        badgeDot.wantsLayer = true
        badgeDot.layer?.cornerRadius = 5

        titleLabel.font = NSFont.systemFont(ofSize: 12, weight: .semibold)
        titleLabel.textColor = .white
        titleLabel.lineBreakMode = .byWordWrapping
        titleLabel.cell?.wraps = true
        titleLabel.cell?.isScrollable = false
        titleLabel.maximumNumberOfLines = 0

        subtitleLabel.font = NSFont.monospacedSystemFont(ofSize: 10.5, weight: .regular)
        subtitleLabel.textColor = NSColor(white: 0.72, alpha: 1.0)
        subtitleLabel.lineBreakMode = .byWordWrapping
        subtitleLabel.cell?.wraps = true
        subtitleLabel.cell?.isScrollable = false
        subtitleLabel.maximumNumberOfLines = 0

        pillContainer.wantsLayer = true
        pillContainer.layer?.cornerRadius = 6

        pillTag.font = NSFont.systemFont(ofSize: 10, weight: .bold)
        pillTag.alignment = .center
        pillTag.drawsBackground = false
        pillTag.isBezeled = false
        pillTag.isEditable = false
        pillTag.isSelectable = false
        pillContainer.addSubview(pillTag)

        containerView.addSubview(badgeDot)
        containerView.addSubview(titleLabel)
        containerView.addSubview(subtitleLabel)
        containerView.addSubview(pillContainer)

        p.contentView = containerView
        self.panel = p
    }

    func show(_ phase: HudPhase) {
        ensurePanel()
        guard let panel = panel, let screen = NSScreen.main ?? NSScreen.screens.first else { return }

        dismissWorkItem?.cancel()

        let notchHeight: CGFloat = {
            if #available(macOS 12.0, *) {
                return screen.safeAreaInsets.top
            }
            return 0
        }()
        let hasNotch = notchHeight > 0

        let width: CGFloat = 388

        switch phase {
        case let .printing(attendee, printer, dims):
            badgeDot.layer?.backgroundColor = NSColor.systemBlue.cgColor
            titleLabel.stringValue = "Printing badge for \(attendee)…"
            subtitleLabel.stringValue = "→ \(printer) (\(dims))"
            pillTag.stringValue = "PRINTING"
            pillTag.textColor = NSColor.systemCyan
            pillContainer.layer?.backgroundColor = NSColor.systemBlue.withAlphaComponent(0.22).cgColor
        case let .completed(attendee, printer):
            badgeDot.layer?.backgroundColor = NSColor.systemGreen.cgColor
            titleLabel.stringValue = "Printed \(attendee)"
            subtitleLabel.stringValue = "✓ \(printer)"
            pillTag.stringValue = "DONE"
            pillTag.textColor = NSColor.systemGreen
            pillContainer.layer?.backgroundColor = NSColor.systemGreen.withAlphaComponent(0.22).cgColor
        case let .failed(attendee, error):
            badgeDot.layer?.backgroundColor = NSColor.systemRed.cgColor
            titleLabel.stringValue = "Print failed: \(attendee)"
            subtitleLabel.stringValue = error
            pillTag.stringValue = "ALERT"
            pillTag.textColor = NSColor.systemRed
            pillContainer.layer?.backgroundColor = NSColor.systemRed.withAlphaComponent(0.22).cgColor
        }

        // Measure wrapped heights for titleLabel and subtitleLabel so no text is ever truncated with ellipsis
        let textWidth = width - 122
        titleLabel.preferredMaxLayoutWidth = textWidth
        subtitleLabel.preferredMaxLayoutWidth = textWidth
        let titleHeight = max(16, ceil(titleLabel.cell?.cellSize(forBounds: NSRect(x: 0, y: 0, width: textWidth, height: 400)).height ?? 16))
        let subtitleHeight = max(14, ceil(subtitleLabel.cell?.cellSize(forBounds: NSRect(x: 0, y: 0, width: textWidth, height: 400)).height ?? 14))

        let verticalPad: CGFloat = 10
        let gap: CGFloat = 3
        let contentHeight = max(50, verticalPad + titleHeight + gap + subtitleHeight + verticalPad)
        let height: CGFloat = hasNotch ? (notchHeight + contentHeight) : contentHeight

        containerView.layer?.cornerRadius = hasNotch ? 20 : 24
        if #available(macOS 11.0, *) {
            // Smooth bottom corners when attached to the top edge of a notched MacBook screen
            containerView.layer?.maskedCorners = hasNotch
                ? [.layerMinXMinYCorner, .layerMaxXMinYCorner]
                : [.layerMinXMinYCorner, .layerMaxXMinYCorner, .layerMinXMaxYCorner, .layerMaxXMaxYCorner]
        }

        containerView.frame = NSRect(x: 0, y: 0, width: width, height: height)
        // In AppKit (y = 0 at bottom), [0 ..< contentHeight] is the visible region BELOW the physical camera notch.
        let centerY = contentHeight / 2.0
        badgeDot.frame = NSRect(x: 16, y: centerY - 5, width: 10, height: 10)
        let pillWidth: CGFloat = 66
        let pillHeight: CGFloat = 20
        pillContainer.frame = NSRect(x: width - pillWidth - 14, y: round(centerY - pillHeight / 2.0), width: pillWidth, height: pillHeight)
        pillTag.sizeToFit()
        let labelHeight = ceil(pillTag.frame.height)
        pillTag.frame = NSRect(x: 0, y: floor((pillHeight - labelHeight) / 2.0), width: pillWidth, height: labelHeight)
        subtitleLabel.frame = NSRect(x: 34, y: verticalPad, width: textWidth, height: subtitleHeight)
        titleLabel.frame = NSRect(x: 34, y: verticalPad + subtitleHeight + gap, width: textWidth, height: titleHeight)

        let screenFrame = screen.frame
        let visibleFrame = screen.visibleFrame
        let targetX = screenFrame.midX - (width / 2)
        // On MacBooks with a notch, anchor flush to the top of the screen so it expands from the notch.
        // On Macs without a notch (iMac, Mac mini, Mac Studio, or external monitors), float just below the menu bar.
        let targetY: CGFloat = hasNotch
            ? (screenFrame.maxY - height)
            : (visibleFrame.maxY - height - 8)

        let startFrame = NSRect(x: screenFrame.midX - 90, y: screenFrame.maxY - 12, width: 180, height: 12)
        let finalFrame = NSRect(x: targetX, y: targetY, width: width, height: height)

        if !panel.isVisible {
            panel.setFrame(startFrame, display: false)
            panel.alphaValue = 0.0
            panel.orderFrontRegardless()
        }

        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.22
            ctx.timingFunction = CAMediaTimingFunction(name: .easeOut)
            panel.animator().setFrame(finalFrame, display: true)
            panel.animator().alphaValue = 1.0
        }

        let holdSeconds: TimeInterval = {
            switch phase {
            case .printing: return 12.0
            case .completed: return 2.6
            case .failed: return 4.5
            }
        }()

        let work = DispatchWorkItem { [weak self] in
            Task { @MainActor in
                self?.hide()
            }
        }
        dismissWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + holdSeconds, execute: work)
    }

    func hide() {
        guard let panel = panel, panel.isVisible, let screen = NSScreen.main ?? NSScreen.screens.first else { return }
        let collapseFrame = NSRect(x: screen.frame.midX - 80, y: screen.frame.maxY - 8, width: 160, height: 8)
        NSAnimationContext.runAnimationGroup({ ctx in
            ctx.duration = 0.18
            ctx.timingFunction = CAMediaTimingFunction(name: .easeIn)
            panel.animator().setFrame(collapseFrame, display: true)
            panel.animator().alphaValue = 0.0
        }, completionHandler: {
            panel.orderOut(nil)
        })
    }
}

// MARK: - Warm In-Process WebKit PDF Renderer

@MainActor
final class LabelPdfRenderer: NSObject, WKNavigationDelegate {
    static let shared = LabelPdfRenderer()

    private var webView: WKWebView?
    private var continuation: CheckedContinuation<Void, Error>?

    private func ensureWebView(widthPt: CGFloat, heightPt: CGFloat) -> WKWebView {
        if let existing = webView {
            existing.frame = NSRect(x: 0, y: 0, width: widthPt, height: heightPt)
            return existing
        }
        let cfg = WKWebViewConfiguration()
        let wv = WKWebView(frame: NSRect(x: 0, y: 0, width: widthPt, height: heightPt), configuration: cfg)
        wv.navigationDelegate = self
        self.webView = wv
        return wv
    }

    func renderHtmlToPdf(html: String, widthMm: Double, heightMm: Double) async throws -> Data {
        let widthPt = CGFloat(widthMm * 72.0 / 25.4)
        let heightPt = CGFloat(heightMm * 72.0 / 25.4)
        let wv = ensureWebView(widthPt: widthPt, heightPt: heightPt)

        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            self.continuation = cont
            wv.loadHTMLString(html, baseURL: URL(string: "https://gdgjakarta.com"))
        }

        // Wait briefly for QR code data-URI or inline images and WebKit layout
        try? await Task.sleep(nanoseconds: 110_000_000)

        let pdfConfig = WKPDFConfiguration()
        pdfConfig.rect = CGRect(x: 0, y: 0, width: widthPt, height: heightPt)
        return try await withCheckedThrowingContinuation { (pdfCont: CheckedContinuation<Data, Error>) in
            wv.createPDF(configuration: pdfConfig) { result in
                switch result {
                case .success(let data):
                    pdfCont.resume(returning: data)
                case .failure(let err):
                    pdfCont.resume(throwing: err)
                }
            }
        }
    }

    /// Renders HTML directly into a 203 DPI (8 dots/mm) packed 1-bit monochrome bitmap for Clabel CT221B TSPL printing.
    /// Note: WKWebView lays out CSS `mm` units at 96 CSS px/inch (3.7795 px/mm), and TSPL `BITMAP` uses 0 = black dot, 1 = white.
    /// For portrait layouts (`heightMm > widthMm`), rotates 90° clockwise onto the physical landscape roll (`heightMm × widthMm`).
    func renderHtmlToMonoBitmap(html: String, widthMm: Double, heightMm: Double) async throws -> (mono: Data, physicalWidthMm: Double, physicalHeightMm: Double) {
        let widthInt = max(10, min(60, Int(widthMm.rounded())))
        let heightInt = max(10, min(120, Int(heightMm.rounded())))
        let isPortrait = heightInt > widthInt
        let widthPx = widthInt * 8
        let heightPx = heightInt * 8
        let cssWidth = CGFloat(Double(widthInt) * 96.0 / 25.4)
        let cssHeight = CGFloat(Double(heightInt) * 96.0 / 25.4)
        let wv = ensureWebView(widthPt: cssWidth, heightPt: cssHeight)

        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            self.continuation = cont
            wv.loadHTMLString(html, baseURL: URL(string: "https://gdgjakarta.com"))
        }

        try? await Task.sleep(nanoseconds: 110_000_000)

        let snapConfig = WKSnapshotConfiguration()
        snapConfig.rect = CGRect(x: 0, y: 0, width: cssWidth, height: cssHeight)
        snapConfig.snapshotWidth = NSNumber(value: widthPx)

        let nsImage: NSImage = try await withCheckedThrowingContinuation { (imgCont: CheckedContinuation<NSImage, Error>) in
            wv.takeSnapshot(with: snapConfig) { image, error in
                if let error = error {
                    imgCont.resume(throwing: error)
                } else if let image = image {
                    imgCont.resume(returning: image)
                } else {
                    imgCont.resume(throwing: NSError(domain: "GDGPrintStation", code: 500, userInfo: [NSLocalizedDescriptionKey: "WebKit snapshot returned nil image."]))
                }
            }
        }

        var proposedRect = NSRect(x: 0, y: 0, width: widthPx, height: heightPx)
        guard let cgImage = nsImage.cgImage(forProposedRect: &proposedRect, context: nil, hints: nil) else {
            throw NSError(domain: "GDGPrintStation", code: 500, userInfo: [NSLocalizedDescriptionKey: "Could not obtain CGImage from label snapshot."])
        }

        let physWidthMm = isPortrait ? heightInt : widthInt
        let physHeightMm = isPortrait ? widthInt : heightInt
        let physPxW = physWidthMm * 8
        let physPxH = physHeightMm * 8

        // Draw into an exact physPxW x physPxH 8-bit grayscale context on white background
        var grayBytes = [UInt8](repeating: 255, count: physPxW * physPxH)
        let colorSpace = CGColorSpaceCreateDeviceGray()
        guard let ctx = CGContext(
            data: &grayBytes,
            width: physPxW,
            height: physPxH,
            bitsPerComponent: 8,
            bytesPerRow: physPxW,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.none.rawValue
        ) else {
            throw NSError(domain: "GDGPrintStation", code: 500, userInfo: [NSLocalizedDescriptionKey: "Could not create grayscale bitmap context."])
        }
        ctx.setFillColor(gray: 1.0, alpha: 1.0)
        ctx.fill(CGRect(x: 0, y: 0, width: physPxW, height: physPxH))
        ctx.interpolationQuality = .high
        if isPortrait {
            // Rotate portrait (widthPx x heightPx) 90° clockwise to fit onto landscape roll (physPxW x physPxH)
            ctx.translateBy(x: 0, y: CGFloat(physPxH))
            ctx.rotate(by: -.pi / 2)
        }
        ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: widthPx, height: heightPx))

        let widthBytes = physWidthMm // 8 dots/mm => 1 byte/mm
        // TSPL BITMAP polarity: 1 = white (unburned), 0 = black thermal dot
        var mono = Data(repeating: 0xFF, count: widthBytes * physPxH)
        mono.withUnsafeMutableBytes { dstRaw in
            let dst = dstRaw.bindMemory(to: UInt8.self)
            for y in 0..<physPxH {
                let srcRow = y * physPxW
                let dstRow = y * widthBytes
                for x in 0..<physPxW {
                    if grayBytes[srcRow + x] < 170 {
                        dst[dstRow + (x >> 3)] &= ~(0x80 >> (x & 7))
                    }
                }
            }
        }
        return (mono, Double(physWidthMm), Double(physHeightMm))
    }

    nonisolated func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        Task { @MainActor in
            self.continuation?.resume()
            self.continuation = nil
        }
    }

    nonisolated func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        Task { @MainActor in
            self.continuation?.resume(throwing: error)
            self.continuation = nil
        }
    }

    nonisolated func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        Task { @MainActor in
            self.continuation?.resume(throwing: error)
            self.continuation = nil
        }
    }
}

// MARK: - Clabel CT221B TSPL Builder & Native CoreBluetooth Manager

enum Ct221bTsplBuilder {
    static let serviceUuid = CBUUID(string: "49535343-FE7D-4AE5-8FA9-9FAFD205E455")
    static let writeCharUuid = CBUUID(string: "49535343-8841-43F4-A8D4-ECBE34729BB3")
    static let notifyCharUuid = CBUUID(string: "49535343-1E4D-4BD9-BA61-23C647249616")

    static func buildPayload(
        monoBitmap: Data,
        widthMm: Double,
        heightMm: Double,
        density: Int = 8,
        gapMm: Int = 2,
        copies: Int = 1
    ) -> Data {
        let w = max(10, min(60, Int(widthMm.rounded())))
        let h = max(10, min(120, Int(heightMm.rounded())))
        let heightDots = h * 8
        let safeDensity = max(1, min(15, density))
        let safeGap = max(0, min(10, gapMm))
        let safeCopies = max(1, min(10, copies))

        let header = [
            "SIZE \(w) mm,\(h) mm",
            "GAP \(safeGap) mm,0 mm",
            "DIRECTION 0,0",
            "REFERENCE 0,0",
            "DENSITY \(safeDensity)",
            "OFFSET 0 mm",
            "SPEED 3",
            "CLS",
            "BITMAP 0,0,\(w),\(heightDots),1,"
        ].joined(separator: "\r\n")

        var payload = Data(header.utf8)
        payload.append(monoBitmap)
        payload.append(Data("\r\nPRINT 1,\(safeCopies)\r\n".utf8))
        return payload
    }

    static func parseBatteryPercent(from frame: Data) -> Int? {
        guard frame.count >= 9 else { return nil }
        let bytes = [UInt8](frame)
        for i in 0...(bytes.count - 9) {
            guard bytes[i] == 0xDD, bytes[i + 1] == 0x00, bytes[i + 4] == 0x00, bytes[i + 5] == 0x01, bytes[i + 8] == 0xDD else {
                continue
            }
            if bytes[i + 2] == 0x05 && bytes[i + 3] == 0x83 && bytes[i + 7] <= 100 {
                return Int(bytes[i + 7])
            }
            if bytes[i + 2] == 0x05 && bytes[i + 3] == 0x86 && bytes[i + 6] <= 100 {
                return Int(bytes[i + 6])
            }
        }
        return nil
    }
}

struct DiscoveredBluetoothDevice {
    var id: String
    var name: String
    var rssi: Int
    var connected: Bool
    var batteryPercent: Int?
}

final class BluetoothPrinterManager: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    static let shared = BluetoothPrinterManager()

    private let bleQueue = DispatchQueue(label: "org.gdgjakarta.printstation.ble")
    private let lock = NSLock()
    private var central: CBCentralManager?
    private var bluetoothStateValue: CBManagerState = .unknown

    private var peripheralsById: [String: CBPeripheral] = [:]
    private var rssiById: [String: Int] = [:]
    private var writeCharsById: [String: CBCharacteristic] = [:]
    private var batteryById: [String: Int] = [:]
    private var lastErrorById: [String: String] = [:]

    private var connectContinuations: [String: CheckedContinuation<String, Error>] = [:]
    private var writeContinuations: [String: CheckedContinuation<Void, Error>] = [:]
    private var readyToSendWaiters: [String: CheckedContinuation<Void, Never>] = [:]

    var onStateChanged: (() -> Void)?

    private override init() {
        super.init()
    }

    func start() {
        bleQueue.async { [weak self] in
            guard let self = self, self.central == nil else { return }
            self.central = CBCentralManager(delegate: self, queue: self.bleQueue)
        }
    }

    func bluetoothStateString() -> String {
        lock.lock()
        let st = bluetoothStateValue
        lock.unlock()
        switch st {
        case .poweredOn: return "poweredOn"
        case .poweredOff: return "poweredOff"
        case .unauthorized: return "unauthorized"
        case .unsupported: return "unsupported"
        case .resetting: return "resetting"
        default: return "unknown"
        }
    }

    func isConnected(id: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard let p = peripheralsById[id] else { return false }
        return p.state == .connected && writeCharsById[id] != nil
    }

    func batteryPercent(for id: String) -> Int? {
        lock.lock()
        defer { lock.unlock() }
        return batteryById[id]
    }

    func lastError(for id: String) -> String? {
        lock.lock()
        defer { lock.unlock() }
        return lastErrorById[id]
    }

    func snapshotDiscovered() -> [DiscoveredBluetoothDevice] {
        lock.lock()
        defer { lock.unlock() }
        return peripheralsById.map { id, p in
            DiscoveredBluetoothDevice(
                id: id,
                name: p.name?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? p.name! : "CT221B",
                rssi: rssiById[id] ?? -60,
                connected: p.state == .connected && writeCharsById[id] != nil,
                batteryPercent: batteryById[id]
            )
        }.sorted { lhs, rhs in
            if lhs.connected != rhs.connected { return lhs.connected }
            return lhs.rssi > rhs.rssi
        }
    }

    func scanForPrinters(durationSeconds: TimeInterval = 4.0) async -> [DiscoveredBluetoothDevice] {
        start()
        // Wait briefly for CoreBluetooth central to power on if just started
        let deadline = Date().addingTimeInterval(1.5)
        while Date() < deadline && bluetoothStateString() == "unknown" {
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
        guard bluetoothStateString() == "poweredOn" else {
            return snapshotDiscovered()
        }

        bleQueue.async { [weak self] in
            guard let self = self, let central = self.central else { return }
            // Also pull any already-connected peripherals exposing the ISSC printer service
            let alreadyConnected = central.retrieveConnectedPeripherals(withServices: [Ct221bTsplBuilder.serviceUuid])
            self.lock.lock()
            for p in alreadyConnected {
                let id = p.identifier.uuidString
                self.peripheralsById[id] = p
                p.delegate = self
            }
            self.lock.unlock()

            central.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
        }

        try? await Task.sleep(nanoseconds: UInt64(durationSeconds * 1_000_000_000))

        bleQueue.async { [weak self] in
            self?.central?.stopScan()
        }
        return snapshotDiscovered()
    }

    func connect(id: String, preferredName: String? = nil) async throws -> String {
        start()
        guard bluetoothStateString() == "poweredOn" else {
            throw NSError(
                domain: "GDGPrintStation",
                code: 503,
                userInfo: [NSLocalizedDescriptionKey: "macOS Bluetooth is \(bluetoothStateString()). Turn on Bluetooth and allow permission in System Settings."]
            )
        }

        var peripheral: CBPeripheral?
        lock.lock()
        peripheral = peripheralsById[id]
        lock.unlock()

        if peripheral == nil, let uuid = UUID(uuidString: id) {
            let retrieved = await withCheckedContinuation { (cont: CheckedContinuation<CBPeripheral?, Never>) in
                bleQueue.async { [weak self] in
                    let list = self?.central?.retrievePeripherals(withIdentifiers: [uuid]) ?? []
                    cont.resume(returning: list.first)
                }
            }
            if let found = retrieved {
                lock.lock()
                peripheralsById[id] = found
                lock.unlock()
                peripheral = found
            }
        }

        guard let target = peripheral else {
            throw NSError(
                domain: "GDGPrintStation",
                code: 404,
                userInfo: [NSLocalizedDescriptionKey: "Bluetooth printer not found. Run a Bluetooth scan first."]
            )
        }

        if isConnected(id: id) {
            let name = preferredName ?? target.name ?? "CT221B"
            saveBluetoothPrinter(id: id, name: name, enabled: true)
            return name
        }

        let resolvedName: String = try await withCheckedThrowingContinuation { cont in
            lock.lock()
            connectContinuations[id] = cont
            lock.unlock()

            bleQueue.async { [weak self] in
                target.delegate = self
                self?.central?.connect(target, options: nil)
            }

            bleQueue.asyncAfter(deadline: .now() + 10.0) { [weak self] in
                guard let self = self else { return }
                self.lock.lock()
                let pending = self.connectContinuations.removeValue(forKey: id)
                self.lock.unlock()
                pending?.resume(throwing: NSError(
                    domain: "GDGPrintStation",
                    code: 504,
                    userInfo: [NSLocalizedDescriptionKey: "Timed out connecting to Bluetooth printer."]
                ))
            }
        }

        let finalName = preferredName ?? resolvedName
        saveBluetoothPrinter(id: id, name: finalName, enabled: true)
        return finalName
    }

    func disconnect(id: String, disableInConfig: Bool = true) {
        lock.lock()
        let peripheral = peripheralsById[id]
        writeCharsById.removeValue(forKey: id)
        lock.unlock()

        if let p = peripheral {
            bleQueue.async { [weak self] in
                self?.central?.cancelPeripheralConnection(p)
            }
        }
        if disableInConfig {
            var cfg = ConfigStore.shared.load()
            var list = cfg.bluetoothPrinters ?? []
            if let idx = list.firstIndex(where: { $0.id == id }) {
                list[idx].enabled = false
                cfg.bluetoothPrinters = list
                ConfigStore.shared.save(cfg)
            }
        }
        notifyStateChanged()
    }

    func toggleSavedBluetoothPrinter(id: String) {
        var cfg = ConfigStore.shared.load()
        var list = cfg.bluetoothPrinters ?? []
        guard let idx = list.firstIndex(where: { $0.id == id }) else { return }
        let nextEnabled = !list[idx].enabled
        list[idx].enabled = nextEnabled
        let name = list[idx].name
        cfg.bluetoothPrinters = list
        ConfigStore.shared.save(cfg)

        if nextEnabled {
            Task {
                _ = try? await self.connect(id: id, preferredName: name)
                PrinterPoolManager.shared.refreshPrinters()
            }
        } else {
            disconnect(id: id, disableInConfig: false)
            PrinterPoolManager.shared.refreshPrinters()
        }
    }

    private func saveBluetoothPrinter(id: String, name: String, enabled: Bool) {
        var cfg = ConfigStore.shared.load()
        var list = cfg.bluetoothPrinters ?? []
        if let idx = list.firstIndex(where: { $0.id == id }) {
            list[idx].name = name
            list[idx].enabled = enabled
        } else {
            list.append(SavedBluetoothPrinter(id: id, name: name, enabled: enabled))
        }
        cfg.bluetoothPrinters = list
        ConfigStore.shared.save(cfg)
    }

    func reconnectSavedPrinters() {
        let saved = (ConfigStore.shared.load().bluetoothPrinters ?? []).filter { $0.enabled }
        guard !saved.isEmpty else { return }
        for item in saved {
            Task {
                _ = try? await self.connect(id: item.id, preferredName: item.name)
                PrinterPoolManager.shared.refreshPrinters()
            }
        }
    }

    func writeTspl(to id: String, payload: Data) async throws {
        lock.lock()
        let peripheral = peripheralsById[id]
        let writeChar = writeCharsById[id]
        lock.unlock()

        guard let p = peripheral, p.state == .connected, let char = writeChar else {
            throw NSError(
                domain: "GDGPrintStation",
                code: 503,
                userInfo: [NSLocalizedDescriptionKey: "Bluetooth printer is disconnected. Turn it on and reconnect."]
            )
        }

        let useWithoutResponse = char.properties.contains(.writeWithoutResponse)
        let writeType: CBCharacteristicWriteType = useWithoutResponse ? .withoutResponse : .withResponse
        let maxLen = max(20, min(180, p.maximumWriteValueLength(for: writeType)))

        var offset = 0
        while offset < payload.count {
            let end = min(offset + maxLen, payload.count)
            let chunk = payload.subdata(in: offset..<end)

            if useWithoutResponse {
                if !p.canSendWriteWithoutResponse {
                    await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
                        lock.lock()
                        readyToSendWaiters[id] = cont
                        lock.unlock()
                    }
                }
                bleQueue.async {
                    p.writeValue(chunk, for: char, type: .withoutResponse)
                }
                // Gentle pacing to avoid overflowing CT221B UART RX ring buffer
                try? await Task.sleep(nanoseconds: 10_000_000)
            } else {
                try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
                    lock.lock()
                    writeContinuations[id] = cont
                    lock.unlock()
                    bleQueue.async {
                        p.writeValue(chunk, for: char, type: .withResponse)
                    }
                }
            }
            offset = end
        }
    }

    private func notifyStateChanged() {
        DispatchQueue.main.async { [weak self] in
            self?.onStateChanged?()
        }
    }

    // MARK: CBCentralManagerDelegate

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        lock.lock()
        bluetoothStateValue = central.state
        lock.unlock()
        if central.state == .poweredOn {
            reconnectSavedPrinters()
        }
        notifyStateChanged()
    }

    func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        let localName = (advertisementData[CBAdvertisementDataLocalNameKey] as? String) ?? peripheral.name ?? ""
        let services = (advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID]) ?? []
        let looksLikeCt221b =
            services.contains(Ct221bTsplBuilder.serviceUuid)
            || localName.localizedCaseInsensitiveContains("CT221")
            || localName.localizedCaseInsensitiveContains("Clabel")
        guard looksLikeCt221b else { return }

        let id = peripheral.identifier.uuidString
        lock.lock()
        peripheralsById[id] = peripheral
        rssiById[id] = RSSI.intValue
        lock.unlock()
        peripheral.delegate = self
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        let id = peripheral.identifier.uuidString
        lock.lock()
        lastErrorById.removeValue(forKey: id)
        lock.unlock()
        peripheral.delegate = self
        peripheral.discoverServices([Ct221bTsplBuilder.serviceUuid])
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        let id = peripheral.identifier.uuidString
        let errMsg = error?.localizedDescription ?? "Failed to connect to Bluetooth printer."
        lock.lock()
        lastErrorById[id] = errMsg
        let cont = connectContinuations.removeValue(forKey: id)
        lock.unlock()
        cont?.resume(throwing: NSError(domain: "GDGPrintStation", code: 503, userInfo: [NSLocalizedDescriptionKey: errMsg]))
        notifyStateChanged()
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        let id = peripheral.identifier.uuidString
        lock.lock()
        writeCharsById.removeValue(forKey: id)
        if let err = error {
            lastErrorById[id] = err.localizedDescription
        }
        let writeCont = writeContinuations.removeValue(forKey: id)
        let readyCont = readyToSendWaiters.removeValue(forKey: id)
        lock.unlock()
        writeCont?.resume(throwing: NSError(domain: "GDGPrintStation", code: 503, userInfo: [NSLocalizedDescriptionKey: "Bluetooth printer disconnected mid-print."]))
        readyCont?.resume()
        notifyStateChanged()
    }

    // MARK: CBPeripheralDelegate

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        let id = peripheral.identifier.uuidString
        if let err = error {
            lock.lock()
            let cont = connectContinuations.removeValue(forKey: id)
            lock.unlock()
            cont?.resume(throwing: err)
            return
        }
        guard let service = peripheral.services?.first(where: { $0.uuid == Ct221bTsplBuilder.serviceUuid }) ?? peripheral.services?.first else {
            lock.lock()
            let cont = connectContinuations.removeValue(forKey: id)
            lock.unlock()
            cont?.resume(throwing: NSError(domain: "GDGPrintStation", code: 404, userInfo: [NSLocalizedDescriptionKey: "CT221B ISSC UART service not found on device."]))
            return
        }
        peripheral.discoverCharacteristics([Ct221bTsplBuilder.writeCharUuid, Ct221bTsplBuilder.notifyCharUuid], for: service)
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        let id = peripheral.identifier.uuidString
        let chars = service.characteristics ?? []
        let writeChar = chars.first(where: { $0.uuid == Ct221bTsplBuilder.writeCharUuid })
            ?? chars.first(where: { $0.properties.contains(.writeWithoutResponse) || $0.properties.contains(.write) })
        let notifyChar = chars.first(where: { $0.uuid == Ct221bTsplBuilder.notifyCharUuid })
            ?? chars.first(where: { $0.properties.contains(.notify) })

        if let n = notifyChar {
            peripheral.setNotifyValue(true, for: n)
        }

        lock.lock()
        if let w = writeChar {
            writeCharsById[id] = w
        }
        let cont = connectContinuations.removeValue(forKey: id)
        lock.unlock()

        if writeChar != nil {
            cont?.resume(returning: peripheral.name ?? "CT221B")
        } else {
            cont?.resume(throwing: NSError(domain: "GDGPrintStation", code: 404, userInfo: [NSLocalizedDescriptionKey: "Writable BLE characteristic not found on CT221B."]))
        }
        notifyStateChanged()
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard let data = characteristic.value else { return }
        if let battery = Ct221bTsplBuilder.parseBatteryPercent(from: data) {
            let id = peripheral.identifier.uuidString
            lock.lock()
            batteryById[id] = battery
            lock.unlock()
            notifyStateChanged()
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        let id = peripheral.identifier.uuidString
        lock.lock()
        let cont = writeContinuations.removeValue(forKey: id)
        lock.unlock()
        if let err = error {
            cont?.resume(throwing: err)
        } else {
            cont?.resume()
        }
    }

    func peripheralIsReady(toSendWriteWithoutResponse peripheral: CBPeripheral) {
        let id = peripheral.identifier.uuidString
        lock.lock()
        let waiter = readyToSendWaiters.removeValue(forKey: id)
        lock.unlock()
        waiter?.resume()
    }
}

// MARK: - Unified CUPS + CoreBluetooth Printer Pool & Parallel Queue Dispatcher

struct PrinterSlotState {
    var name: String
    var transport: String // "usb" | "bluetooth"
    var uri: String?
    var state: String
    var busy: Bool
    var available: Bool
    var lastError: String?
    var queueDepth: Int
    var usbConnected: Bool
    var bluetoothConnected: Bool?
    var batteryPercent: Int?
    var bluetoothId: String?
    var unavailableUntil: Date
}

final class PrinterPoolManager {
    static let shared = PrinterPoolManager()

    private let lock = NSLock()
    private var slots: [PrinterSlotState] = []
    private var cachedInstalledPrinters: [String] = []
    private var recentJobResults: [String: (date: Date, printer: String, message: String)] = [:]
    var onStateChanged: (() -> Void)?

    private init() {}

    func cachedInstalledCupsPrinters() -> [String] {
        lock.lock()
        defer { lock.unlock() }
        return cachedInstalledPrinters
    }

    func listAllInstalledCupsPrinters() -> [String] {
        let out = Shell.run("/usr/bin/lpstat", ["-e"]).stdout
        return out.components(separatedBy: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }

    func readCupsUris() -> [String: String] {
        var result: [String: String] = [:]
        let out = Shell.run("/usr/bin/lpstat", ["-v"]).stdout
        for line in out.components(separatedBy: "\n") {
            if let range = line.range(of: "device for "),
               let colonRange = line.range(of: ": ", range: range.upperBound..<line.endIndex) {
                let name = String(line[range.upperBound..<colonRange.lowerBound]).trimmingCharacters(in: .whitespaces)
                let uri = String(line[colonRange.upperBound...]).trimmingCharacters(in: .whitespaces)
                result[name] = uri
            }
        }
        return result
    }

    private func readQueueDepth(for printer: String) -> Int {
        guard !printer.isEmpty else { return 0 }
        let out = Shell.run("/usr/bin/lpstat", ["-W", "not-completed", "-o", printer]).stdout
        if out.isEmpty { return 0 }
        return out.components(separatedBy: "\n").filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }.count
    }

    private func readPrinterStateLine(for printer: String) -> String {
        let args = printer.isEmpty ? ["-p"] : ["-p", printer]
        let res = Shell.run("/usr/bin/lpstat", args)
        if res.code != 0 || res.stdout.isEmpty { return "unavailable" }
        return res.stdout.components(separatedBy: "\n").first ?? "unknown"
    }

    private func detectUsbPresence() -> String {
        return Shell.run("/usr/sbin/ioreg", ["-p", "IOUSB", "-l", "-w0"]).stdout
    }

    /// Automatically fixes duplicate Clabel USB URIs that share a single serial= by binding each queue to its unique USB location= hex ID.
    @discardableResult
    func autoFixSharedUsbPorts() -> [String] {
        let uris = readCupsUris()
        var byUri: [String: [String]] = [:]
        for (name, uri) in uris where uri.hasPrefix("usb://") {
            byUri[uri, default: []].append(name)
        }
        let sharedGroups = byUri.filter { $0.value.count > 1 }
        guard !sharedGroups.isEmpty else { return [] }

        // Extract hex locationIDs of Clabel / CT221B USB devices from ioreg
        let ioreg = Shell.run("/usr/sbin/ioreg", ["-p", "IOUSB", "-l", "-w0"]).stdout
        var locationHexes: [String] = []
        var inClabelBlock = false
        for line in ioreg.components(separatedBy: "\n") {
            if line.contains("CT221B") || line.localizedCaseInsensitiveContains("Clabel") {
                inClabelBlock = true
            }
            if inClabelBlock, line.contains("\"locationID\" =") {
                let digits = line.components(separatedBy: "=").last?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                if let dec = UInt64(digits) {
                    let hex = String(format: "%08llx", dec)
                    if !locationHexes.contains(hex) {
                        locationHexes.append(hex)
                    }
                    inClabelBlock = false
                }
            }
        }

        var fixedMessages: [String] = []
        for (uri, printers) in sharedGroups.sorted(by: { $0.key < $1.key }) {
            guard let baseUri = uri.components(separatedBy: "?").first else { continue }
            for (idx, printerName) in printers.sorted().enumerated() where idx < locationHexes.count {
                let newUri = "\(baseUri)?location=\(locationHexes[idx])"
                let res = Shell.run("/usr/sbin/lpadmin", ["-p", printerName, "-v", newUri, "-E"])
                if res.code == 0 {
                    fixedMessages.append("\(printerName) -> \(newUri)")
                }
            }
        }
        if !fixedMessages.isEmpty {
            refreshPrinters()
        }
        return fixedMessages
    }

    func refreshPrinters() {
        var cfg = ConfigStore.shared.load()
        let allInstalled = listAllInstalledCupsPrinters()
        let uris = readCupsUris()
        let usbDump = detectUsbPresence()
        let hasClabelUsb = usbDump.contains("CT221B") || usbDump.localizedCaseInsensitiveContains("Clabel")

        var selected = cfg.printers.filter { allInstalled.contains($0) }
        if selected.isEmpty && cfg.userConfiguredPrinters != true {
            let clabels = allInstalled.filter { $0.localizedCaseInsensitiveContains("clabel") || $0.localizedCaseInsensitiveContains("ct221") }
            selected = !clabels.isEmpty ? clabels : allInstalled
            if !selected.isEmpty {
                cfg.printers = selected
                ConfigStore.shared.save(cfg)
            }
        }

        // Read CUPS states & queue depths OUTSIDE lock so UI/HTTP readers never block on shell processes
        lock.lock()
        let oldByName = Dictionary(uniqueKeysWithValues: slots.map { ($0.name, $0) })
        lock.unlock()

        let now = Date()
        var computedSlots: [PrinterSlotState] = selected.map { name in
            let prev = oldByName[name]
            let stateLine = readPrinterStateLine(for: name)
            let qDepth = readQueueDepth(for: name)
            let isUnavailable = stateLine == "unavailable" || stateLine.localizedCaseInsensitiveContains("disabled") || stateLine.localizedCaseInsensitiveContains("offline")
            let isClabel = name.localizedCaseInsensitiveContains("clabel") || (uris[name]?.localizedCaseInsensitiveContains("clabel") ?? false)
            let usbOk = isClabel ? hasClabelUsb : true
            let cooldownUntil = prev?.unavailableUntil ?? .distantPast
            let available = !isUnavailable && cooldownUntil <= now
            return PrinterSlotState(
                name: name,
                transport: "usb",
                uri: uris[name],
                state: stateLine,
                busy: prev?.busy ?? false,
                available: available,
                lastError: prev?.lastError,
                queueDepth: qDepth,
                usbConnected: usbOk,
                bluetoothConnected: nil,
                batteryPercent: nil,
                bluetoothId: nil,
                unavailableUntil: cooldownUntil
            )
        }

        // Append enabled CoreBluetooth CT221B printers into the unified pool
        let savedBt = (cfg.bluetoothPrinters ?? []).filter { $0.enabled }
        for bt in savedBt {
            let slotName = bt.name.hasSuffix(" (BLE)") ? bt.name : "\(bt.name) (BLE)"
            let prev = oldByName[slotName]
            let isConnected = BluetoothPrinterManager.shared.isConnected(id: bt.id)
            let battery = BluetoothPrinterManager.shared.batteryPercent(for: bt.id)
            let btErr = BluetoothPrinterManager.shared.lastError(for: bt.id)
            let cooldownUntil = prev?.unavailableUntil ?? .distantPast
            computedSlots.append(
                PrinterSlotState(
                    name: slotName,
                    transport: "bluetooth",
                    uri: "ble://\(bt.id)",
                    state: isConnected ? "idle (Bluetooth BLE)" : "Bluetooth disconnected",
                    busy: prev?.busy ?? false,
                    available: isConnected && cooldownUntil <= now,
                    lastError: isConnected ? prev?.lastError : (btErr ?? "Bluetooth printer disconnected"),
                    queueDepth: 0,
                    usbConnected: true,
                    bluetoothConnected: isConnected,
                    batteryPercent: battery,
                    bluetoothId: bt.id,
                    unavailableUntil: cooldownUntil
                )
            )
        }

        lock.lock()
        // Preserve live `busy` flags in case a print job started while we were polling CUPS
        let currentBusyByName = Dictionary(uniqueKeysWithValues: slots.map { ($0.name, $0.busy) })
        cachedInstalledPrinters = allInstalled
        slots = computedSlots.map { s in
            var copy = s
            if let b = currentBusyByName[s.name] {
                copy.busy = b
            }
            return copy
        }
        lock.unlock()

        DispatchQueue.main.async { [weak self] in
            self?.onStateChanged?()
        }
    }

    func togglePrinter(_ printerName: String) {
        DispatchQueue.global(qos: .userInitiated).async {
            var cfg = ConfigStore.shared.load()
            let wasEnabled = cfg.printers.contains(printerName)
            if wasEnabled {
                cfg.printers.removeAll { $0 == printerName }
            } else {
                cfg.printers.append(printerName)
            }
            cfg.userConfiguredPrinters = true
            ConfigStore.shared.save(cfg)
            self.refreshPrinters()
            let count = cfg.printers.count
            DispatchQueue.main.async {
                if wasEnabled {
                    NotchDynamicIslandController.shared.show(
                        .completed(
                            attendee: "Disabled \(printerName)",
                            printer: count == 0 ? "All printers disabled on this Mac" : "\(count) printer\(count == 1 ? "" : "s") enabled"
                        )
                    )
                } else {
                    NotchDynamicIslandController.shared.show(
                        .completed(
                            attendee: "Enabled \(printerName)",
                            printer: "\(count) printer\(count == 1 ? "" : "s") enabled"
                        )
                    )
                }
            }
        }
    }

    func cancelStuckCupsJobs() {
        let all = listAllInstalledCupsPrinters()
        for name in all {
            _ = Shell.run("/usr/bin/cancel", ["-a", name])
            _ = Shell.run("/usr/sbin/cupsenable", [name])
            _ = Shell.run("/usr/sbin/cupsaccept", [name])
        }
        refreshPrinters()
    }

    /// Instant O(1) memory snapshot with zero subprocess calls — safe to call on the main UI thread or HTTP thread.
    func snapshotSlots() -> [PrinterSlotState] {
        lock.lock()
        defer { lock.unlock() }
        let now = Date()
        return slots.map { s in
            var copy = s
            if s.transport == "bluetooth" {
                let btConn = s.bluetoothId.map { BluetoothPrinterManager.shared.isConnected(id: $0) } ?? false
                copy.bluetoothConnected = btConn
                copy.batteryPercent = s.bluetoothId.flatMap { BluetoothPrinterManager.shared.batteryPercent(for: $0) }
                copy.state = btConn ? "idle (Bluetooth BLE)" : "Bluetooth disconnected"
                copy.available = btConn && s.unavailableUntil <= now
            } else {
                let isUnavailable = s.state == "unavailable" || s.state.localizedCaseInsensitiveContains("disabled") || !s.usbConnected
                copy.available = !isUnavailable && s.unavailableUntil <= now
            }
            return copy
        }
    }

    func printBadge(
        html: String,
        widthMm: Double,
        heightMm: Double,
        copies: Int,
        requestedPrinter: String?,
        jobId: String?,
        attendeeName: String?,
        density: Int = 8,
        gapMm: Int = 2
    ) async throws -> (printer: String, message: String) {
        let displayAttendee = (attendeeName?.isEmpty == false) ? attendeeName! : "Attendee Badge"
        let cleanJobId = jobId?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let jid = cleanJobId, !jid.isEmpty {
            lock.lock()
            // Prune entries older than 90s
            let cutoff = Date().addingTimeInterval(-90)
            recentJobResults = recentJobResults.filter { $0.value.date > cutoff }
            if let cached = recentJobResults[jid] {
                lock.unlock()
                return (cached.printer, cached.message)
            }
            lock.unlock()
        }

        // Refresh live USB hardware presence before selecting a printer so unplugged USB printers are rejected immediately
        let usbDump = detectUsbPresence()
        let hasLiveClabelUsb = usbDump.contains("CT221B") || usbDump.localizedCaseInsensitiveContains("Clabel")

        // Select target printer slot
        let chosenPrinter: String
        let chosenTransport: String
        let chosenBluetoothId: String?
        do {
            lock.lock()
            defer { lock.unlock() }
            for i in slots.indices {
                if slots[i].transport == "bluetooth" {
                    let btConn = slots[i].bluetoothId.map { BluetoothPrinterManager.shared.isConnected(id: $0) } ?? false
                    slots[i].bluetoothConnected = btConn
                } else {
                    let isClabel = slots[i].name.localizedCaseInsensitiveContains("clabel") || (slots[i].uri?.localizedCaseInsensitiveContains("clabel") ?? false)
                    if isClabel {
                        slots[i].usbConnected = hasLiveClabelUsb
                    }
                }
            }
            if slots.isEmpty {
                throw NSError(
                    domain: "GDGPrintStation",
                    code: 404,
                    userInfo: [NSLocalizedDescriptionKey: "No printers enabled in GDG Print Station."]
                )
            }
            let isSlotReachable: (PrinterSlotState) -> Bool = { s in
                s.transport == "bluetooth" ? (s.bluetoothConnected == true) : s.usbConnected
            }
            if let req = requestedPrinter, !req.isEmpty {
                guard let idx = slots.firstIndex(where: { $0.name == req }) else {
                    throw NSError(
                        domain: "GDGPrintStation",
                        code: 404,
                        userInfo: [NSLocalizedDescriptionKey: "Unknown or disabled printer \"\(req)\"."]
                    )
                }
                if !isSlotReachable(slots[idx]) {
                    let reason = slots[idx].transport == "bluetooth"
                        ? "\(slots[idx].name) is Bluetooth disconnected or turned off."
                        : "\(slots[idx].name) is USB unplugged or turned off."
                    throw NSError(domain: "GDGPrintStation", code: 503, userInfo: [NSLocalizedDescriptionKey: reason])
                }
                slots[idx].busy = true
                chosenPrinter = slots[idx].name
                chosenTransport = slots[idx].transport
                chosenBluetoothId = slots[idx].bluetoothId
            } else if let idx = slots.firstIndex(where: { !$0.busy && isSlotReachable($0) && $0.available }) ?? slots.firstIndex(where: { !$0.busy && isSlotReachable($0) }) {
                slots[idx].busy = true
                chosenPrinter = slots[idx].name
                chosenTransport = slots[idx].transport
                chosenBluetoothId = slots[idx].bluetoothId
            } else if slots.allSatisfy({ !isSlotReachable($0) }) {
                throw NSError(
                    domain: "GDGPrintStation",
                    code: 503,
                    userInfo: [NSLocalizedDescriptionKey: "All configured printers are unplugged or disconnected."]
                )
            } else {
                throw NSError(
                    domain: "GDGPrintStation",
                    code: 503,
                    userInfo: [NSLocalizedDescriptionKey: "All connected printers are currently busy."]
                )
            }
        } catch {
            let errText = error.localizedDescription
            await MainActor.run {
                self.onStateChanged?()
                NotchDynamicIslandController.shared.show(.failed(attendee: displayAttendee, error: errText))
            }
            throw error
        }

        let dimsText = chosenTransport == "bluetooth" ? "\(Int(widthMm))×\(Int(heightMm))mm • BLE" : "\(Int(widthMm))×\(Int(heightMm))mm"

        await MainActor.run {
            self.onStateChanged?()
            NotchDynamicIslandController.shared.show(.printing(attendee: displayAttendee, printer: chosenPrinter, dimensions: dimsText))
        }

        defer {
            lock.lock()
            if let idx = slots.firstIndex(where: { $0.name == chosenPrinter }) {
                slots[idx].busy = false
            }
            lock.unlock()
            DispatchQueue.main.async { [weak self] in
                self?.onStateChanged?()
            }
        }

        do {
            // Bluetooth CT221B direct TSPL path
            if chosenTransport == "bluetooth", let btId = chosenBluetoothId {
                let rendered = try await LabelPdfRenderer.shared.renderHtmlToMonoBitmap(
                    html: html,
                    widthMm: widthMm,
                    heightMm: heightMm
                )
                let tsplPayload = Ct221bTsplBuilder.buildPayload(
                    monoBitmap: rendered.mono,
                    widthMm: rendered.physicalWidthMm,
                    heightMm: rendered.physicalHeightMm,
                    density: density,
                    gapMm: gapMm,
                    copies: copies
                )
                try await BluetoothPrinterManager.shared.writeTspl(to: btId, payload: tsplPayload)

                let btMessage = "Sent \(tsplPayload.count) TSPL bytes over BLE to \(chosenPrinter)"
                lock.lock()
                if let idx = slots.firstIndex(where: { $0.name == chosenPrinter }) {
                    slots[idx].lastError = nil
                    slots[idx].unavailableUntil = .distantPast
                }
                if let jid = cleanJobId, !jid.isEmpty {
                    recentJobResults[jid] = (Date(), chosenPrinter, btMessage)
                }
                lock.unlock()

                await MainActor.run {
                    NotchDynamicIslandController.shared.show(.completed(attendee: displayAttendee, printer: chosenPrinter))
                }
                return (chosenPrinter, btMessage)
            }

            // 1. Check CUPS queue status before submitting
            let stateLine = readPrinterStateLine(for: chosenPrinter)
            if stateLine == "unavailable" || stateLine.localizedCaseInsensitiveContains("disabled") {
                _ = Shell.run("/usr/sbin/cupsenable", [chosenPrinter])
                _ = Shell.run("/usr/sbin/cupsaccept", [chosenPrinter])
            }

            // 2. Render HTML -> PDF in-process via WebKit
            let pdfData = try await LabelPdfRenderer.shared.renderHtmlToPdf(html: html, widthMm: widthMm, heightMm: heightMm)
            let tmpFile = FileManager.default.temporaryDirectory.appendingPathComponent("gdg-badge-\(UUID().uuidString).pdf")
            try pdfData.write(to: tmpFile)
            defer { try? FileManager.default.removeItem(at: tmpFile) }

            // 3. Submit to CUPS via `lp`
            let lpArgs = [
                "-n", String(max(1, min(10, copies))),
                "-o", "media=Custom.\(Int(widthMm))x\(Int(heightMm))mm",
                "-o", "scaling=100",
                "-d", chosenPrinter,
                tmpFile.path
            ]
            let lpRes = Shell.run("/usr/bin/lp", lpArgs, timeout: 12.0)
            if lpRes.code != 0 {
                let errMsg = lpRes.stderr.isEmpty ? lpRes.stdout : lpRes.stderr
                throw NSError(domain: "GDGPrintStation", code: 500, userInfo: [NSLocalizedDescriptionKey: "CUPS lp failed on \(chosenPrinter): \(errMsg)"])
            }

            // Extract CUPS job ID (e.g. "request id is Clabel__CT221B__Fachri_-42 (1 file(s))")
            let lpMessage = lpRes.stdout
            var cupsRequestId: String?
            if let range = lpMessage.range(of: "request id is ") {
                let rest = lpMessage[range.upperBound...]
                cupsRequestId = rest.components(separatedBy: " ").first
            }

            // 4. Monitor CUPS queue (up to 3.0s) to verify the job actually leaves the spooler to the USB printer
            if let reqId = cupsRequestId {
                let pollDeadline = Date().addingTimeInterval(3.0)
                var leftSpool = false
                while Date() < pollDeadline {
                    let qOut = Shell.run("/usr/bin/lpstat", ["-W", "not-completed", "-o", chosenPrinter]).stdout
                    if !qOut.contains(reqId) {
                        leftSpool = true
                        break // Spooler finished sending to USB printer!
                    }
                    try? await Task.sleep(nanoseconds: 250_000_000)
                }
                if !leftSpool {
                    // Check if the USB device was unplugged mid-print or if CUPS is stuck waiting for printer
                    let postUsb = detectUsbPresence()
                    let isClabel = chosenPrinter.localizedCaseInsensitiveContains("clabel")
                    let usbStillPresent = isClabel ? (postUsb.contains("CT221B") || postUsb.localizedCaseInsensitiveContains("Clabel")) : true
                    let pState = readPrinterStateLine(for: chosenPrinter)
                    if !usbStillPresent || pState.localizedCaseInsensitiveContains("waiting for printer") || pState.localizedCaseInsensitiveContains("offline") || pState.localizedCaseInsensitiveContains("unplugged") {
                        _ = Shell.run("/usr/bin/cancel", [reqId])
                        throw NSError(
                            domain: "GDGPrintStation",
                            code: 503,
                            userInfo: [NSLocalizedDescriptionKey: "\(chosenPrinter) USB unplugged or not responding (canceled stuck spool job)."]
                        )
                    }
                }
            }

            lock.lock()
            if let idx = slots.firstIndex(where: { $0.name == chosenPrinter }) {
                slots[idx].lastError = nil
                slots[idx].unavailableUntil = .distantPast
            }
            if let jid = cleanJobId, !jid.isEmpty {
                recentJobResults[jid] = (Date(), chosenPrinter, lpMessage)
            }
            lock.unlock()

            await MainActor.run {
                NotchDynamicIslandController.shared.show(.completed(attendee: displayAttendee, printer: chosenPrinter))
            }

            return (chosenPrinter, lpMessage)
        } catch {
            let errText = error.localizedDescription
            lock.lock()
            if let idx = slots.firstIndex(where: { $0.name == chosenPrinter }) {
                slots[idx].lastError = errText
                slots[idx].unavailableUntil = Date().addingTimeInterval(15)
            }
            lock.unlock()

            await MainActor.run {
                NotchDynamicIslandController.shared.show(.failed(attendee: displayAttendee, error: errText))
            }
            throw error
        }
    }
}

// MARK: - Loopback HTTP Server (127.0.0.1:17777)

final class LoopbackHttpServer {
    private var listener: NWListener?
    private let queue = DispatchQueue(label: "org.gdgjakarta.printstation.http", attributes: .concurrent)
    let device = DeviceIdentity.resolve()

    func start(port: UInt16) {
        do {
            let params = NWParameters.tcp
            params.allowLocalEndpointReuse = true
            guard let nwPort = NWEndpoint.Port(rawValue: port) else { return }
            let lst = try NWListener(using: params, on: nwPort)
            lst.newConnectionHandler = { [weak self] conn in
                self?.handleConnection(conn)
            }
            lst.start(queue: queue)
            self.listener = lst
        } catch {
            fputs("Failed to start HTTP listener on port \(port): \(error)\n", stderr)
        }
    }

    private func handleConnection(_ conn: NWConnection) {
        conn.start(queue: queue)
        receiveFullHttpRequest(conn: conn, buffer: Data())
    }

    private func receiveFullHttpRequest(conn: NWConnection, buffer: Data) {
        conn.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, error in
            guard let self = self else { return }
            if error != nil {
                conn.cancel()
                return
            }
            var accumulated = buffer
            if let d = data { accumulated.append(d) }

            if let headerEndRange = accumulated.range(of: Data("\r\n\r\n".utf8)) {
                let headerData = accumulated.subdata(in: 0..<headerEndRange.lowerBound)
                let headerString = String(data: headerData, encoding: .utf8) ?? ""
                let bodyStart = headerEndRange.upperBound
                let contentLength = self.parseContentLength(headerString)
                let currentBodyLength = accumulated.count - bodyStart
                if currentBodyLength >= contentLength || isComplete {
                    let bodyData = accumulated.subdata(in: bodyStart..<min(accumulated.count, bodyStart + contentLength))
                    self.routeRequest(conn: conn, headerString: headerString, bodyData: bodyData)
                    return
                }
            }

            if isComplete || accumulated.count > 2 * 1024 * 1024 {
                conn.cancel()
                return
            }
            self.receiveFullHttpRequest(conn: conn, buffer: accumulated)
        }
    }

    private func parseContentLength(_ header: String) -> Int {
        for line in header.components(separatedBy: "\r\n") {
            if line.lowercased().hasPrefix("content-length:") {
                let val = line.dropFirst("content-length:".count).trimmingCharacters(in: .whitespaces)
                return Int(val) ?? 0
            }
        }
        return 0
    }

    private func parseOrigin(_ header: String) -> String? {
        for line in header.components(separatedBy: "\r\n") {
            if line.lowercased().hasPrefix("origin:") {
                return line.dropFirst("origin:".count).trimmingCharacters(in: .whitespaces)
            }
        }
        return nil
    }

    private func isOriginAllowed(_ origin: String?) -> Bool {
        guard let origin = origin, !origin.isEmpty else { return true }
        let cfg = ConfigStore.shared.load()
        if cfg.allowedOrigins.contains(origin) { return true }
        if origin.hasPrefix("http://localhost:") || origin.hasPrefix("http://127.0.0.1:") { return true }
        if origin.hasSuffix(".gdgjakarta.com") || origin.hasSuffix(".gdgjakarta.org") { return true }
        return false
    }

    private func routeRequest(conn: NWConnection, headerString: String, bodyData: Data) {
        let lines = headerString.components(separatedBy: "\r\n")
        guard let requestLine = lines.first else {
            conn.cancel()
            return
        }
        let parts = requestLine.components(separatedBy: " ")
        let method = parts.count > 0 ? parts[0] : "GET"
        let fullPath = parts.count > 1 ? parts[1] : "/"
        let path = fullPath.components(separatedBy: "?").first ?? "/"
        let origin = parseOrigin(headerString)

        if !isOriginAllowed(origin) {
            sendJson(conn: conn, status: "403 Forbidden", origin: origin, json: ["ok": false, "error": "Origin \(origin ?? "") is not allowed."])
            return
        }

        if method == "OPTIONS" {
            sendResponse(conn: conn, status: "204 No Content", origin: origin, contentType: "text/plain", body: Data())
            return
        }

        if method == "GET" && path == "/health" {
            let slots = PrinterPoolManager.shared.snapshotSlots()
            let printersJson: [[String: Any]] = slots.map { s in
                var entry: [String: Any] = [
                    "name": s.name,
                    "transport": s.transport,
                    "uri": s.uri as Any,
                    "state": s.state,
                    "busy": s.busy,
                    "available": s.available,
                    "lastError": s.lastError as Any,
                    "queueDepth": s.queueDepth,
                    "usbConnected": s.usbConnected
                ]
                if let btConn = s.bluetoothConnected {
                    entry["bluetoothConnected"] = btConn
                }
                if let battery = s.batteryPercent {
                    entry["batteryPercent"] = battery
                }
                if let btId = s.bluetoothId {
                    entry["bluetoothId"] = btId
                }
                return entry
            }
            let payload: [String: Any] = [
                "ok": true,
                "version": WORKER_VERSION,
                "device": [
                    "id": device.id,
                    "computerName": device.computerName,
                    "model": device.model as Any,
                    "os": device.os,
                    "appMode": "menubar",
                    "bluetoothState": BluetoothPrinterManager.shared.bluetoothStateString()
                ],
                "printers": printersJson,
                "queued": 0
            ]
            sendJson(conn: conn, status: "200 OK", origin: origin, json: payload)
            return
        }

        if method == "POST" && path == "/bluetooth/scan" {
            Task {
                let devices = await BluetoothPrinterManager.shared.scanForPrinters(durationSeconds: 4.0)
                let list: [[String: Any]] = devices.map { d in
                    var item: [String: Any] = [
                        "id": d.id,
                        "name": d.name,
                        "rssi": d.rssi,
                        "connected": d.connected
                    ]
                    if let batt = d.batteryPercent {
                        item["batteryPercent"] = batt
                    }
                    return item
                }
                self.sendJson(conn: conn, status: "200 OK", origin: origin, json: [
                    "ok": true,
                    "bluetoothState": BluetoothPrinterManager.shared.bluetoothStateString(),
                    "devices": list
                ])
            }
            return
        }

        if method == "POST" && path == "/bluetooth/connect" {
            guard let jsonObj = try? JSONSerialization.jsonObject(with: bodyData) as? [String: Any],
                  let id = jsonObj["id"] as? String, !id.isEmpty else {
                sendJson(conn: conn, status: "400 Bad Request", origin: origin, json: ["ok": false, "error": "`id` is required"])
                return
            }
            let name = jsonObj["name"] as? String
            Task {
                do {
                    let connectedName = try await BluetoothPrinterManager.shared.connect(id: id, preferredName: name)
                    PrinterPoolManager.shared.refreshPrinters()
                    await MainActor.run {
                        NotchDynamicIslandController.shared.show(.completed(attendee: "Bluetooth Connected", printer: "\(connectedName) (BLE)"))
                    }
                    self.sendJson(conn: conn, status: "200 OK", origin: origin, json: [
                        "ok": true,
                        "printer": "\(connectedName) (BLE)"
                    ])
                } catch {
                    self.sendJson(conn: conn, status: "500 Internal Server Error", origin: origin, json: [
                        "ok": false,
                        "error": error.localizedDescription
                    ])
                }
            }
            return
        }

        if method == "POST" && path == "/bluetooth/disconnect" {
            guard let jsonObj = try? JSONSerialization.jsonObject(with: bodyData) as? [String: Any],
                  let id = jsonObj["id"] as? String, !id.isEmpty else {
                sendJson(conn: conn, status: "400 Bad Request", origin: origin, json: ["ok": false, "error": "`id` is required"])
                return
            }
            BluetoothPrinterManager.shared.disconnect(id: id, disableInConfig: true)
            PrinterPoolManager.shared.refreshPrinters()
            sendJson(conn: conn, status: "200 OK", origin: origin, json: ["ok": true])
            return
        }

        if method == "POST" && path == "/print" {
            guard let jsonObj = try? JSONSerialization.jsonObject(with: bodyData) as? [String: Any],
                  let html = jsonObj["html"] as? String, !html.isEmpty else {
                sendJson(conn: conn, status: "400 Bad Request", origin: origin, json: ["ok": false, "error": "`html` is required"])
                return
            }
            let widthMm = (jsonObj["widthMm"] as? NSNumber)?.doubleValue ?? 50.0
            let heightMm = (jsonObj["heightMm"] as? NSNumber)?.doubleValue ?? 30.0
            let copies = (jsonObj["copies"] as? NSNumber)?.intValue ?? 1
            let printer = jsonObj["printer"] as? String
            let jobId = jsonObj["jobId"] as? String
            let attendeeName = jsonObj["attendeeName"] as? String
            let density = (jsonObj["density"] as? NSNumber)?.intValue ?? 8
            let gapMm = (jsonObj["gapMm"] as? NSNumber)?.intValue ?? 2

            Task {
                do {
                    let res = try await PrinterPoolManager.shared.printBadge(
                        html: html,
                        widthMm: widthMm,
                        heightMm: heightMm,
                        copies: copies,
                        requestedPrinter: printer,
                        jobId: jobId,
                        attendeeName: attendeeName,
                        density: density,
                        gapMm: gapMm
                    )
                    self.sendJson(conn: conn, status: "200 OK", origin: origin, json: [
                        "ok": true,
                        "printer": res.printer,
                        "message": res.message
                    ])
                } catch {
                    self.sendJson(conn: conn, status: "500 Internal Server Error", origin: origin, json: [
                        "ok": false,
                        "error": error.localizedDescription
                    ])
                }
            }
            return
        }

        sendJson(conn: conn, status: "404 Not Found", origin: origin, json: ["ok": false, "error": "Not found"])
    }

    private func sendJson(conn: NWConnection, status: String, origin: String?, json: [String: Any]) {
        let data = (try? JSONSerialization.data(withJSONObject: json)) ?? Data("{\"ok\":false}".utf8)
        sendResponse(conn: conn, status: status, origin: origin, contentType: "application/json", body: data)
    }

    private func sendResponse(conn: NWConnection, status: String, origin: String?, contentType: String, body: Data) {
        var headers = [
            "HTTP/1.1 \(status)",
            "Content-Type: \(contentType)",
            "Content-Length: \(body.count)",
            "Connection: close"
        ]
        if let origin = origin, !origin.isEmpty {
            headers.append("Access-Control-Allow-Origin: \(origin)")
            headers.append("Access-Control-Allow-Methods: GET, POST, OPTIONS")
            headers.append("Access-Control-Allow-Headers: Content-Type")
            headers.append("Access-Control-Allow-Private-Network: true")
            headers.append("Vary: Origin")
        } else {
            headers.append("Access-Control-Allow-Origin: *")
        }
        headers.append("\r\n")
        var packet = Data(headers.joined(separator: "\r\n").utf8)
        packet.append(body)
        conn.send(content: packet, completion: .contentProcessed { _ in
            conn.cancel()
        })
    }
}

// MARK: - macOS Menu Bar Application Delegate

@MainActor
final class PrintStationAppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private let server = LoopbackHttpServer()
    private var refreshTimer: Timer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        if let icoUrl = Bundle.main.url(forResource: "favicon", withExtension: "ico") ?? Bundle.main.url(forResource: "AppIcon", withExtension: "icns"),
           let appIcon = NSImage(contentsOf: icoUrl) {
            NSApp.applicationIconImage = appIcon
        }

        let cfg = ConfigStore.shared.load()
        LegacyWorkerCleaner.cleanupPreviousInstallations(port: cfg.port)

        // Start loopback HTTP server immediately so /health is ready within <100ms
        server.start(port: UInt16(cfg.port))

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        updateStatusBarTitle()

        PrinterPoolManager.shared.onStateChanged = { [weak self] in
            Task { @MainActor in
                self?.rebuildMenu()
                self?.updateStatusBarTitle()
            }
        }
        BluetoothPrinterManager.shared.onStateChanged = { [weak self] in
            DispatchQueue.global(qos: .utility).async {
                PrinterPoolManager.shared.refreshPrinters()
                Task { @MainActor in
                    self?.rebuildMenu()
                    self?.updateStatusBarTitle()
                }
            }
        }
        BluetoothPrinterManager.shared.start()

        rebuildMenu()

        DispatchQueue.global(qos: .userInitiated).async {
            _ = PrinterPoolManager.shared.autoFixSharedUsbPorts()
            PrinterPoolManager.shared.refreshPrinters()
            let slots = PrinterPoolManager.shared.snapshotSlots()
            let usbCount = slots.filter { $0.usbConnected }.count
            let summary: String = {
                if slots.isEmpty { return "No USB printers found" }
                if usbCount == 0 {
                    return "\(slots.count) printer\(slots.count == 1 ? "" : "s") configured (USB unplugged)"
                }
                return "\(usbCount) USB printer\(usbCount == 1 ? "" : "s") connected & ready"
            }()
            DispatchQueue.main.async {
                NotchDynamicIslandController.shared.show(.completed(attendee: "GDG Print Station Online", printer: summary))
            }
        }

        refreshTimer = Timer.scheduledTimer(withTimeInterval: 8.0, repeats: true) { [weak self] _ in
            DispatchQueue.global(qos: .utility).async {
                PrinterPoolManager.shared.refreshPrinters()
                DispatchQueue.main.async {
                    self?.updateStatusBarTitle()
                    self?.rebuildMenu()
                }
            }
        }
    }

    private func updateStatusBarTitle() {
        guard let button = statusItem.button else { return }
        let slots = PrinterPoolManager.shared.snapshotSlots()
        let readyCount = slots.filter { $0.available }.count
        let isPrinting = slots.contains { $0.busy }

        if let img = NSImage(systemSymbolName: isPrinting ? "printer.dotmatrix.fill" : "printer.fill", accessibilityDescription: "GDG Print Station") {
            img.isTemplate = true
            button.image = img
            button.imagePosition = .imageLeading
        }
        button.title = " \(readyCount)"
    }

    private func rebuildMenu() {
        let menu = NSMenu()
        let cfg = ConfigStore.shared.load()
        let slots = PrinterPoolManager.shared.snapshotSlots()
        let allInstalled = PrinterPoolManager.shared.cachedInstalledCupsPrinters()

        let headerItem = NSMenuItem(title: "GDG Print Station • v\(WORKER_VERSION)", action: nil, keyEquivalent: "")
        headerItem.isEnabled = false
        menu.addItem(headerItem)

        let subHeaderItem = NSMenuItem(title: "Online on 127.0.0.1:\(cfg.port) (\(server.device.computerName))", action: nil, keyEquivalent: "")
        subHeaderItem.isEnabled = false
        menu.addItem(subHeaderItem)

        menu.addItem(.separator())

        let sectionItem = NSMenuItem(title: "Configured Printers (Click to Toggle):", action: nil, keyEquivalent: "")
        sectionItem.isEnabled = false
        menu.addItem(sectionItem)

        if allInstalled.isEmpty {
            let emptyItem = NSMenuItem(title: "No CUPS printers found in System Settings", action: nil, keyEquivalent: "")
            emptyItem.isEnabled = false
            menu.addItem(emptyItem)
        } else {
            for (index, printerName) in allInstalled.enumerated() {
                let matchedSlot = slots.first { $0.name == printerName }
                let statusBadge: String = {
                    guard let s = matchedSlot else { return "Disabled in Station" }
                    if s.busy { return "Printing…" }
                    if !s.usbConnected { return "USB Unplugged" }
                    if !s.available { return "Offline" }
                    return s.queueDepth > 0 ? "Ready (\(s.queueDepth) in spool)" : "Ready • Printer #\(index + 1)"
                }()

                let item = NSMenuItem(
                    title: "\(printerName) — \(statusBadge)",
                    action: #selector(handleTogglePrinter(_:)),
                    keyEquivalent: ""
                )
                item.target = self
                item.representedObject = printerName
                item.state = matchedSlot != nil ? .on : .off
                menu.addItem(item)
            }
        }

        menu.addItem(.separator())

        let btSectionItem = NSMenuItem(
            title: "Bluetooth Printers (CT221B • \(BluetoothPrinterManager.shared.bluetoothStateString())):",
            action: nil,
            keyEquivalent: ""
        )
        btSectionItem.isEnabled = false
        menu.addItem(btSectionItem)

        let savedBt = cfg.bluetoothPrinters ?? []
        if savedBt.isEmpty {
            let emptyBt = NSMenuItem(title: "No Bluetooth CT221B paired yet", action: nil, keyEquivalent: "")
            emptyBt.isEnabled = false
            menu.addItem(emptyBt)
        } else {
            for bt in savedBt {
                let connected = BluetoothPrinterManager.shared.isConnected(id: bt.id)
                let batt = BluetoothPrinterManager.shared.batteryPercent(for: bt.id)
                let battText = batt.map { " • \($0)%" } ?? ""
                let statusText = !bt.enabled ? "Disabled" : (connected ? "Ready • BLE\(battText)" : "Disconnected")
                let item = NSMenuItem(
                    title: "\(bt.name) — \(statusText)",
                    action: #selector(handleToggleBluetoothPrinter(_:)),
                    keyEquivalent: ""
                )
                item.target = self
                item.representedObject = bt.id
                item.state = bt.enabled ? .on : .off
                menu.addItem(item)
            }
        }

        let scanBtItem = NSMenuItem(title: "Scan & Connect Bluetooth CT221B…", action: #selector(handleScanBluetooth), keyEquivalent: "b")
        scanBtItem.target = self
        menu.addItem(scanBtItem)

        menu.addItem(.separator())

        let refreshItem = NSMenuItem(title: "Refresh Printers & Auto-Fix USB Ports", action: #selector(handleRefreshPrinters), keyEquivalent: "r")
        refreshItem.target = self
        menu.addItem(refreshItem)

        let testItem = NSMenuItem(title: "Test Print Sample Badge (50×30mm)", action: #selector(handleTestPrint), keyEquivalent: "t")
        testItem.target = self
        menu.addItem(testItem)

        let clearItem = NSMenuItem(title: "Clear Stuck CUPS Print Queues", action: #selector(handleClearStuckJobs), keyEquivalent: "")
        clearItem.target = self
        menu.addItem(clearItem)

        let openDashboardItem = NSMenuItem(title: "Open Dashboard Printers Page…", action: #selector(handleOpenDashboard), keyEquivalent: "o")
        openDashboardItem.target = self
        menu.addItem(openDashboardItem)

        menu.addItem(.separator())

        let quitItem = NSMenuItem(title: "Quit GDG Print Station", action: #selector(handleQuit), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        statusItem.menu = menu
    }

    @objc private func handleTogglePrinter(_ sender: NSMenuItem) {
        guard let name = sender.representedObject as? String else { return }
        PrinterPoolManager.shared.togglePrinter(name)
    }

    @objc private func handleToggleBluetoothPrinter(_ sender: NSMenuItem) {
        guard let id = sender.representedObject as? String else { return }
        BluetoothPrinterManager.shared.toggleSavedBluetoothPrinter(id: id)
    }

    @objc private func handleScanBluetooth() {
        NotchDynamicIslandController.shared.show(.printing(attendee: "Scanning Bluetooth…", printer: "Looking for Clabel CT221B", dimensions: "BLE"))
        Task {
            let found = await BluetoothPrinterManager.shared.scanForPrinters(durationSeconds: 4.0)
            if let first = found.first(where: { !$0.connected }) ?? found.first {
                do {
                    let name = try await BluetoothPrinterManager.shared.connect(id: first.id, preferredName: first.name)
                    PrinterPoolManager.shared.refreshPrinters()
                    await MainActor.run {
                        NotchDynamicIslandController.shared.show(.completed(attendee: "Bluetooth Connected", printer: "\(name) (BLE)"))
                    }
                } catch {
                    await MainActor.run {
                        NotchDynamicIslandController.shared.show(.failed(attendee: "Bluetooth Connect Failed", error: error.localizedDescription))
                    }
                }
            } else {
                await MainActor.run {
                    NotchDynamicIslandController.shared.show(.failed(attendee: "No CT221B Found", error: "Ensure printer is ON (blinking blue LED)"))
                }
            }
        }
    }

    @objc private func handleRefreshPrinters() {
        NotchDynamicIslandController.shared.show(.printing(attendee: "Refreshing Printers…", printer: "Scanning USB devices", dimensions: "USB"))
        DispatchQueue.global(qos: .userInitiated).async {
            let fixed = PrinterPoolManager.shared.autoFixSharedUsbPorts()
            PrinterPoolManager.shared.refreshPrinters()
            let slots = PrinterPoolManager.shared.snapshotSlots()
            let usbCount = slots.filter { $0.usbConnected }.count
            let msg: String = {
                if !fixed.isEmpty {
                    return "Fixed shared USB ports (\(fixed.count))"
                }
                if slots.isEmpty {
                    return "No printers configured"
                }
                if usbCount == 0 {
                    return "\(slots.count) printer\(slots.count == 1 ? "" : "s") configured (USB unplugged)"
                }
                return "\(usbCount)/\(slots.count) USB printer\(slots.count == 1 ? "" : "s") connected & ready"
            }()
            DispatchQueue.main.async {
                NotchDynamicIslandController.shared.show(.completed(attendee: "Printers Refreshed", printer: msg))
            }
        }
    }

    @objc private func handleClearStuckJobs() {
        DispatchQueue.global(qos: .userInitiated).async {
            PrinterPoolManager.shared.cancelStuckCupsJobs()
            DispatchQueue.main.async {
                NotchDynamicIslandController.shared.show(.completed(attendee: "CUPS Queues Cleared", printer: "All printers reset to Idle"))
            }
        }
    }

    private func makeQrDataUri(for text: String) -> String {
        guard let data = text.data(using: .utf8),
              let filter = CIFilter(name: "CIQRCodeGenerator") else {
            return ""
        }
        filter.setValue(data, forKey: "inputMessage")
        filter.setValue("M", forKey: "inputCorrectionLevel")
        guard let outputImage = filter.outputImage else { return "" }
        let scaled = outputImage.transformed(by: CGAffineTransform(scaleX: 8, y: 8))
        let rep = NSCIImageRep(ciImage: scaled)
        let nsImage = NSImage(size: rep.size)
        nsImage.addRepresentation(rep)
        guard let tiff = nsImage.tiffRepresentation,
              let bmp = NSBitmapImageRep(data: tiff),
              let png = bmp.representation(using: .png, properties: [:]) else {
            return ""
        }
        return "data:image/png;base64,\(png.base64EncodedString())"
    }

    @objc private func handleTestPrint() {
        let qrDataUri = makeQrDataUri(for: "https://gdgjakarta.com/dashboard/printers")
        let qrTag = qrDataUri.isEmpty ? "" : "<img src=\"\(qrDataUri)\" alt=\"QR\" />"
        let escapedHost = server.device.computerName
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
        let sampleHtml = """
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Badge: GDG Jakarta Print Station</title>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
            <link
              href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Google+Sans+Flex:wght@100..900&display=block"
              rel="stylesheet"
            />
            <style>
              @page {
                size: 50mm 30mm;
                margin: 0;
              }

              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }

              body {
                margin: 0;
                width: 50mm;
                height: 30mm;
                overflow: hidden;
                font-family: 'Google Sans', 'Google Sans Flex', -apple-system, Arial, sans-serif;
                font-weight: 400;
                background-color: #ffffff;
                color: #000000;
              }

              .ticket-badge {
                width: 50mm;
                height: 30mm;
                padding: 2mm 2.5mm;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                overflow: hidden;
              }

              .attendee-name {
                flex: 0 0 auto;
                font-size: 16pt;
                font-weight: 400;
                line-height: 1.15;
                white-space: normal;
                overflow-wrap: break-word;
                word-break: break-word;
                text-transform: capitalize;
              }

              .ticket-body {
                flex: 1;
                min-height: 0;
                display: flex;
                flex-direction: row;
                align-items: flex-end;
                justify-content: space-between;
                gap: 2mm;
              }

              .ticket-details {
                flex: 1 1 0%;
                min-width: 0;
                height: 100%;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                overflow: hidden;
              }

              .attendee-title {
                font-size: 6.5pt;
                font-family: 'Google Sans Flex', 'Google Sans', -apple-system, Arial, sans-serif;
                font-weight: 300;
                line-height: 1.2;
                white-space: normal;
                overflow-wrap: break-word;
                word-break: break-word;
              }

              .attendee-company {
                font-size: 5.5pt;
                font-family: 'Google Sans Flex', 'Google Sans', -apple-system, Arial, sans-serif;
                font-weight: 300;
                line-height: 1.2;
                margin-top: 0.3mm;
                white-space: normal;
                overflow-wrap: break-word;
                word-break: break-word;
              }

              .attendee-title:empty,
              .attendee-company:empty {
                display: none;
              }

              .ticket-details > div:first-child {
                flex: 0 0 auto;
                min-width: 0;
              }

              .ref-code {
                flex: 0 0 auto;
                font-size: 5pt;
                font-weight: 400;
                font-variant-numeric: tabular-nums;
                letter-spacing: 0.3px;
                line-height: 1.1;
                white-space: normal;
                overflow-wrap: break-word;
                word-break: break-word;
                align-self: flex-start;
              }

              .ticket-footer {
                flex: 0 0 auto;
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 0.3mm;
              }

              .ticket-badge-pill {
                align-self: flex-start;
                font-size: 4.2pt;
                font-weight: 700;
                padding: 0.5mm 1.5mm;
                background-color: #000000;
                color: #ffffff;
                border-radius: 2px;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                line-height: 1.1;
              }

              .event-name {
                font-size: 5pt;
                font-family: 'Google Sans Flex', 'Google Sans', -apple-system, Arial, sans-serif;
                font-weight: 300;
                line-height: 1.15;
                white-space: normal;
                overflow-wrap: break-word;
                word-break: break-word;
              }

              .ticket-qr-section {
                flex: 0 0 17.5mm;
                width: 17.5mm;
                height: 17.5mm;
                display: flex;
                align-items: center;
                justify-content: center;
              }

              .qr-container {
                width: 100%;
                height: 100%;
                display: block;
              }

              .qr-container svg,
              .qr-container img {
                width: 100%;
                height: 100%;
                display: block;
                shape-rendering: crispEdges;
                image-rendering: pixelated;
              }
            </style>
          </head>
          <body>
            <div class="ticket-badge">
              <div class="attendee-name" data-fit-lines="1">Test Print OK</div>

              <div class="ticket-body">
                <div class="ticket-details">
                  <div>
                    <div class="attendee-title">Print Station v\(WORKER_VERSION)</div>
                    <div class="attendee-company">\(escapedHost)</div>
                  </div>
                  <div class="ref-code">GDGJKT-TEST-2026</div>
                  <div class="ticket-footer">
                    <span class="ticket-badge-pill">TEST BADGE</span>
                    <div class="event-name">GDG Jakarta Print Station</div>
                  </div>
                </div>

                <div class="ticket-qr-section">
                  <div class="qr-container">\(qrTag)</div>
                </div>
              </div>
            </div>
          </body>
        </html>
        """
        Task {
            _ = try? await PrinterPoolManager.shared.printBadge(
                html: sampleHtml,
                widthMm: 50,
                heightMm: 30,
                copies: 1,
                requestedPrinter: nil,
                jobId: nil,
                attendeeName: "Sample Test Badge"
            )
        }
    }

    @objc private func handleOpenDashboard() {
        if let url = URL(string: "https://gdgjakarta.com/dashboard/printers") {
            NSWorkspace.shared.open(url)
        }
    }

    @objc private func handleQuit() {
        NSApp.terminate(nil)
    }
}

// MARK: - CLI & App Entrypoint

let args = Array(CommandLine.arguments.dropFirst())
if let first = args.first {
    switch first {
    case "version", "--version", "-v":
        print(WORKER_VERSION)
        exit(0)
    case "stop":
        let cfg = ConfigStore.shared.load()
        LegacyWorkerCleaner.cleanupPreviousInstallations(port: cfg.port)
        print("GDG Print Station stopped.")
        exit(0)
    case "uninstall", "cleanup":
        let cfg = ConfigStore.shared.load()
        LegacyWorkerCleaner.cleanupPreviousInstallations(port: cfg.port)
        print("Cleaned up legacy CLI worker and stopped listening processes.")
        exit(0)
    case "setup":
        let cfg = ConfigStore.shared.load()
        LegacyWorkerCleaner.cleanupPreviousInstallations(port: cfg.port)
        _ = PrinterPoolManager.shared.autoFixSharedUsbPorts()
        PrinterPoolManager.shared.refreshPrinters()
        print("GDG Print Station v\(WORKER_VERSION) configured printers: \(ConfigStore.shared.load().printers.joined(separator: ", "))")
        // Continue into launching the menu bar app if invoked interactively
    default:
        break
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = MainActor.assumeIsolated { PrintStationAppDelegate() }
app.delegate = delegate
app.run()
