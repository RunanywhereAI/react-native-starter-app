package ai.runanywhere.starter;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import android.os.Build;
import android.os.StrictMode;
import androidx.core.content.FileProvider;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.FileOutputStream;
import android.content.res.AssetManager;

public class StorageModule extends ReactContextBaseJavaModule {
    StorageModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "StorageModule";
    }

    @ReactMethod
    public void unpackAsset(final String assetFilename, final String destinationPath, final Promise promise) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    AssetManager assetManager = getReactApplicationContext().getAssets();
                    InputStream in = assetManager.open("models/" + assetFilename);
                    OutputStream out = new FileOutputStream(destinationPath);
                    byte[] buffer = new byte[8192];
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                    }
                    in.close();
                    out.flush();
                    out.close();
                    promise.resolve(destinationPath);
                } catch (Exception e) {
                    promise.reject("UNPACK_ASSET_ERROR", e);
                }
            }
        }).start();
    }

    @ReactMethod
    public void openAllFilesAccessSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                intent.addCategory(Intent.CATEGORY_DEFAULT);
                intent.setData(Uri.parse("package:" + getReactApplicationContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getReactApplicationContext().startActivity(intent);
            } catch (Exception e) {
                Intent backupIntent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                backupIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getReactApplicationContext().startActivity(backupIntent);
            }
        }
    }

    @ReactMethod
    public void openPDF(String absolutePath) {
        try {
            Uri contentUri;
            if (absolutePath.startsWith("content://")) {
                contentUri = Uri.parse(absolutePath);
            } else {
                if (absolutePath.startsWith("file://")) {
                    absolutePath = absolutePath.substring(7);
                }
                java.io.File file = new java.io.File(absolutePath);
                contentUri = FileProvider.getUriForFile(getReactApplicationContext(), getReactApplicationContext().getPackageName() + ".fileprovider", file);
            }
            
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(contentUri, "application/pdf");
            
            // Modern Android requires ClipData for propagating URI permissions properly
            intent.setClipData(android.content.ClipData.newRawUri("", contentUri));
            intent.setFlags(Intent.FLAG_ACTIVITY_NO_HISTORY | Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            
            getReactApplicationContext().startActivity(intent);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @ReactMethod
    public void shareImage(String absolutePath) {
        try {
            Uri contentUri;
            if (absolutePath.startsWith("content://")) {
                contentUri = Uri.parse(absolutePath);
            } else {
                if (absolutePath.startsWith("file://")) {
                    absolutePath = absolutePath.substring(7);
                }
                java.io.File file = new java.io.File(absolutePath);
                contentUri = FileProvider.getUriForFile(getReactApplicationContext(), getReactApplicationContext().getPackageName() + ".fileprovider", file);
            }
            
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("image/*");
            shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
            
            // Modern Android requires ClipData for propagating URI permissions properly
            shareIntent.setClipData(android.content.ClipData.newRawUri("", contentUri));
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            
            Intent chooser = Intent.createChooser(shareIntent, "Share Image");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            
            getReactApplicationContext().startActivity(chooser);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
