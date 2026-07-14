import Foundation
import Vision
import AppKit
import ImageIO

struct OCRLine: Codable {
  let text: String
  let confidence: Float
  let boundingBox: [String: Double]
}

struct OCRResult: Codable {
  let fullText: String
  let lines: [OCRLine]
  let averageConfidence: Float
  let engine: String
  let sourceAssetId: String
  let createdAt: String
  let sourceHash: String?
}

let args = Array(CommandLine.arguments.dropFirst())
guard args.count >= 2, args.count % 2 == 0 else {
  FileHandle.standardError.write(Data("Usage: swift apple-vision-ocr.swift <image> <assetId> [<image> <assetId> ...]\n".utf8))
  exit(2)
}

func recognize(imagePath: String, assetId: String) throws -> OCRResult {
  let url = URL(fileURLWithPath: imagePath)
  guard let source = CGImageSourceCreateWithURL(url as CFURL, nil), let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    return OCRResult(fullText: "", lines: [], averageConfidence: 0, engine: "apple_vision", sourceAssetId: assetId, createdAt: ISO8601DateFormatter().string(from: Date()), sourceHash: nil)
  }
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.recognitionLanguages = ["en-US"]
  request.usesLanguageCorrection = false
  let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
  try handler.perform([request])
  let observations = request.results ?? []
  let lines = observations.compactMap { observation -> OCRLine? in
    guard let candidate = observation.topCandidates(1).first else { return nil }
    return OCRLine(text: candidate.string, confidence: candidate.confidence, boundingBox: [
      "x": observation.boundingBox.origin.x,
      "y": observation.boundingBox.origin.y,
      "width": observation.boundingBox.size.width,
      "height": observation.boundingBox.size.height
    ])
  }
  return OCRResult(
    fullText: lines.map { $0.text }.joined(separator: "\n"),
    lines: lines,
    averageConfidence: lines.isEmpty ? 0 : lines.map { $0.confidence }.reduce(0, +) / Float(lines.count),
    engine: "apple_vision",
    sourceAssetId: assetId,
    createdAt: ISO8601DateFormatter().string(from: Date()),
    sourceHash: nil
  )
}

do {
  var results: [OCRResult] = []
  var index = 0
  while index < args.count {
    results.append(try recognize(imagePath: args[index], assetId: args[index + 1]))
    index += 2
  }
  FileHandle.standardOutput.write(try JSONEncoder().encode(results))
} catch {
  FileHandle.standardError.write(Data(error.localizedDescription.utf8))
  exit(4)
}
