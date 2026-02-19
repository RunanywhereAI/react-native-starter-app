package ai.runanywhere.starter; // This must match your folder structure

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions;
import android.net.Uri;
import java.io.IOException;

public class OCRModule extends ReactContextBaseJavaModule {
    OCRModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "OCRModule"; // This is the name you'll use in JavaScript
    }

    @ReactMethod
    public void scanImage(String imageUri, Promise promise) {
        try {
            InputImage image = InputImage.fromFilePath(getReactApplicationContext(), Uri.parse(imageUri));
            TextRecognizer recognizer = TextRecognition.getClient(new DevanagariTextRecognizerOptions.Builder().build());

            recognizer.process(image)
                .addOnSuccessListener(visionText -> promise.resolve(visionText.getText()))
                .addOnFailureListener(e -> promise.reject("OCR_ERROR", e.getMessage()));
        } catch (IOException e) {
            promise.reject("IMAGE_ERROR", e.getMessage());
        }
    }
}
