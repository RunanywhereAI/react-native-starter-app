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

public class StorageModule extends ReactContextBaseJavaModule {
    StorageModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "StorageModule";
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
            java.io.File file = new java.io.File(absolutePath);
            Uri contentUri = FileProvider.getUriForFile(getReactApplicationContext(), getReactApplicationContext().getPackageName() + ".fileprovider", file);
            
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(contentUri, "application/pdf");
            intent.setFlags(Intent.FLAG_ACTIVITY_NO_HISTORY | Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            
            getReactApplicationContext().startActivity(intent);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
