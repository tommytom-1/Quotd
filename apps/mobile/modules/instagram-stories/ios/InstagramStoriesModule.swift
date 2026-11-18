import CoreImage
import ExpoModulesCore
import UIKit

/// Hands a picture to Instagram's Story editor: a background filling the
/// screen and a sticker lying on it, which the user can move, turn and resize
/// before posting. Instagram reads both from the pasteboard once opened.
public class InstagramStoriesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("InstagramStories")

    AsyncFunction("isAvailable") { () -> Bool in
      guard let url = URL(string: "instagram-stories://share") else {
        return false
      }
      return UIApplication.shared.canOpenURL(url)
    }
    .runOnQueue(.main)

    // The photo enlarged to fill the story and blurred, a little darkened so
    // the polaroid stands out on it.
    AsyncFunction("makeBackground") { (photoUri: URL, width: Int, height: Int) -> String in
      guard let photo = UIImage(contentsOfFile: photoUri.path) else {
        throw Exception(name: "PhotoUnreadable", description: "Could not read the photo.")
      }
      let size = CGSize(width: width, height: height)
      // Blurred small and then enlarged: a softer blur for far less work.
      let small = CGSize(width: (size.width / 4).rounded(), height: (size.height / 4).rounded())
      let filled = render(size: small, opaque: true) { _ in
        let scale = max(small.width / photo.size.width, small.height / photo.size.height)
        let drawn = CGSize(width: photo.size.width * scale, height: photo.size.height * scale)
        photo.draw(in: CGRect(
          x: (small.width - drawn.width) / 2,
          y: (small.height - drawn.height) / 2,
          width: drawn.width,
          height: drawn.height
        ))
      }

      guard let filledImage = filled.cgImage,
            let blur = CIFilter(name: "CIGaussianBlur") else {
        throw Exception(name: "BlurFailed", description: "Could not blur the photo.")
      }
      let input = CIImage(cgImage: filledImage)
      // Clamped first, so the blur does not fade the edges to transparent.
      blur.setValue(input.clampedToExtent(), forKey: kCIInputImageKey)
      blur.setValue(small.width * 0.035, forKey: kCIInputRadiusKey)
      // Drawn on the CPU: the image is small, and the GPU path came back blank
      // in the simulator.
      let context = CIContext(options: [.useSoftwareRenderer: true])
      guard let output = blur.outputImage,
            let blurred = context.createCGImage(output, from: input.extent) else {
        throw Exception(name: "BlurFailed", description: "Could not blur the photo.")
      }

      let background = render(size: size, opaque: true) { context in
        UIImage(cgImage: blurred).draw(in: CGRect(origin: .zero, size: size))
        UIColor.black.withAlphaComponent(0.12).setFill()
        // Laid over the photo; a plain fill would replace it.
        context.fill(CGRect(origin: .zero, size: size), blendMode: .normal)
      }
      guard let data = background.jpegData(compressionQuality: 0.9) else {
        throw Exception(name: "EncodeFailed", description: "Could not save the background.")
      }
      return try write(data, ext: "jpg")
    }

    AsyncFunction("share") { (options: StoryOptions, promise: Promise) in
      guard let url = URL(string: "instagram-stories://share?source_application=\(options.appId)"),
            UIApplication.shared.canOpenURL(url) else {
        promise.resolve(false)
        return
      }
      guard let sticker = UIImage(contentsOfFile: options.stickerUri.path),
            let stickerData = withShadow(sticker).pngData() else {
        promise.reject(Exception(name: "StickerUnreadable", description: "Could not read the polaroid."))
        return
      }

      var item: [String: Any] = ["com.instagram.sharedSticker.stickerImage": stickerData]
      if let backgroundUri = options.backgroundUri,
         let background = try? Data(contentsOf: backgroundUri) {
        item["com.instagram.sharedSticker.backgroundImage"] = background
      } else {
        item["com.instagram.sharedSticker.backgroundTopColor"] = options.topColor
        item["com.instagram.sharedSticker.backgroundBottomColor"] = options.bottomColor
      }
      UIPasteboard.general.setItems(
        [item],
        options: [.expirationDate: Date().addingTimeInterval(5 * 60)]
      )
      UIApplication.shared.open(url) { opened in
        promise.resolve(opened)
      }
    }
    .runOnQueue(.main)
  }
}

struct StoryOptions: Record {
  @Field var appId: String = ""
  @Field var stickerUri: URL = URL(fileURLWithPath: "")
  @Field var backgroundUri: URL?
  @Field var topColor: String = "#F3F2EE"
  @Field var bottomColor: String = "#E4E1DA"
}

private func render(
  size: CGSize,
  opaque: Bool,
  draw: (UIGraphicsImageRendererContext) -> Void
) -> UIImage {
  let format = UIGraphicsImageRendererFormat()
  format.scale = 1
  format.opaque = opaque
  return UIGraphicsImageRenderer(size: size, format: format).image(actions: draw)
}

/// Instagram draws stickers flat, so the polaroid brings its own soft shadow,
/// with transparent room around it to fall into.
private func withShadow(_ image: UIImage) -> UIImage {
  let pixels = CGSize(width: image.size.width * image.scale, height: image.size.height * image.scale)
  let room = pixels.width * 0.08
  let size = CGSize(width: pixels.width + room * 2, height: pixels.height + room * 2)
  return render(size: size, opaque: false) { context in
    context.cgContext.setShadow(
      offset: CGSize(width: 0, height: room * 0.3),
      blur: room * 0.7,
      color: UIColor.black.withAlphaComponent(0.28).cgColor
    )
    image.draw(in: CGRect(x: room, y: room, width: pixels.width, height: pixels.height))
  }
}

private func write(_ data: Data, ext: String) throws -> String {
  let url = FileManager.default.temporaryDirectory
    .appendingPathComponent("story-\(UUID().uuidString).\(ext)")
  try data.write(to: url)
  return url.absoluteString
}
