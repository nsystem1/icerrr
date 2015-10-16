/*
       Licensed to the Apache Software Foundation (ASF) under one
       or more contributor license agreements.  See the NOTICE file
       distributed with this work for additional information
       regarding copyright ownership.  The ASF licenses this file
       to you under the Apache License, Version 2.0 (the
       "License"); you may not use this file except in compliance
       with the License.  You may obtain a copy of the License at

         http://www.apache.org/licenses/LICENSE-2.0

       Unless required by applicable law or agreed to in writing,
       software distributed under the License is distributed on an
       "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
       KIND, either express or implied.  See the License for the
       specific language governing permissions and limitations
       under the License.
 */

package com.rejh.icerrr.itson;

import java.util.Calendar;

import org.apache.cordova.Config;
import org.apache.cordova.DroidGap;

import android.app.Activity;
import android.app.KeyguardManager;
import android.app.KeyguardManager.KeyguardLock;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.PowerManager;
import android.util.Log;
import android.view.KeyEvent;
import android.webkit.WebView;

public class Icerrr extends DroidGap
{
    
	final static String APPTAG = "Icerrr";
	
	private SharedPreferences sett;
	
	private long intentTime = -1;
	
	private Handler keyguardHandler; 
	private Runnable keyguardRunnable;
	private KeyguardManager keyguardManager;
	private KeyguardLock lock;
	private long timeKeyguardDisabled = 0;
    
    @Override
    public void onCreate(Bundle savedInstanceState)
    {
    	
        super.onCreate(savedInstanceState);

        // Preferences
        sett = getSharedPreferences(APPTAG,Context.MODE_MULTI_PROCESS | 2);
        
        // Clear cache
        super.clearCache();
        super.appView.getSettings().setAllowFileAccess(true);
        
        // Set by <content src="index.html" /> in config.xml
        super.setStringProperty("url", null); 
        super.setStringProperty("errorUrl",null); 
        super.loadUrl(Config.getStartUrl());
        
        //super.loadUrl("file:///android_asset/www/index.html")
        if(Build.VERSION.SDK_INT >= 19) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        
        JavaScriptInterface jsInterface = new JavaScriptInterface(this);
        // super.appView.getSettings().setJavaScriptEnabled(true);
        super.appView.addJavascriptInterface(jsInterface, "JSInterface");
        
        // Keyguard (lockscreen)
        keyguardManager = (KeyguardManager) getSystemService(Activity.KEYGUARD_SERVICE);
        lock = keyguardManager.newKeyguardLock(KEYGUARD_SERVICE);
        
        // Kill App Receiver
        IntentFilter filter = new IntentFilter();
        filter.addAction("com.rejh.icerrr.itson.actions.KILL_APP");
        registerReceiver(killAppReceiver, filter);
        
        // Call onNewIntent when app is not started before..
        onNewIntent(getIntent());
        
    }
    
    @Override
    public void onStart() {
        Log.d(APPTAG,APPTAG +".onStart()");
    	super.onStart();
    }
    
    @Override
    public void onResume() {
        Log.d(APPTAG,APPTAG +".onResume()");
        super.onResume();
        Intent incomingIntent = getIntent(); 
        String functionCall = "setTimeout(function() { site.lifecycle.onNewIntent('" + incomingIntent.getDataString() + "',"+ intentTime +"); },1);";
        Log.d(APPTAG," > "+ functionCall);
    	super.sendJavascript(functionCall);
    }
    
    @Override
    public void onPause() {
    	Log.d(APPTAG,APPTAG+".onPause()");
    	super.onPause();
    	skiplock(false);
    }
    
    @Override
    public void onNewIntent(Intent newIntent) {
        
    	Log.d(APPTAG,APPTAG +".onNewIntent()");
    	super.onNewIntent(newIntent);
    	
    	// Store new intent
    	setIntent(newIntent);
    	
    	// Store intentTime so the app doesn't respond to onResume firing the same intent..
    	Calendar calnow = Calendar.getInstance();
		calnow.setTimeInMillis(System.currentTimeMillis());
		intentTime = calnow.getTimeInMillis();
    	
    	// Check if extra cmd==alarm, dismiss keyguard
    	if (newIntent.hasExtra("cmd")) {
    		if (newIntent.getStringExtra("cmd").equals("alarm")) {
    			Log.w(APPTAG," -> onNewIntent: Extra 'cmd' == 'alarm', dismiss keyguard || turn screen on :D");
    			//getWindow().addFlags(WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON); // doesn't dismiss keyguard at all
    			//getWindow().addFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON); // meh keeps keyguard dismissed for activity..
    			skiplock(true);
    		}
    	}
    }
    
    @Override
    public void onDestroy() {
    	super.onDestroy();
    	unregisterReceiver(killAppReceiver);
    }
    
    // --------------------------------------
    // Keys
    
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {

        //If volume down key
        if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            super.loadUrl("javascript:cordova.fireDocumentEvent('volumedownbutton');");
            return true;
        } else if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
            super.loadUrl("javascript:cordova.fireDocumentEvent('volumeupbutton');");
            return true;
        } else {
            //return super.onKeyDown(keyCode, event); 
        }
        //return super.onKeyDown(keyCode, event);

        return true;
    }
    /**/
    
    // Keyguard
    private void skiplock(boolean action) {
    	skiplock(action,false);
    }
    private void skiplock(boolean action, boolean force) {
    	
    	Log.d(APPTAG,APPTAG+".skiplock(): "+ action);
    	
    	if (!sett.getBoolean("turnOnScreenForAlarms",true)) {
    		Log.d(APPTAG," -> Disabled, do nothing..");
    		return;
    	}
    	
    	if (!force && System.currentTimeMillis() < timeKeyguardDisabled+1000) {
    		Log.d(APPTAG," -> !Force and timeKeyguardDisabled<1s ago, do nothing..");
    		return;
    	}
    	
    	if (keyguardRunnable==null) {
    		keyguardRunnable = new Runnable() { 
                public void run() { 
               	 skiplock(false,true);
                } 
           };
    	}
        
        // DO IT
        if (action == true) {
            
        	// Power up display
        	Log.d(APPTAG," -> Wakelock: turn on display, 30s");
    		PowerManager powerMgr = (PowerManager) getApplicationContext().getSystemService(Context.POWER_SERVICE);
    		PowerManager.WakeLock wakelock = powerMgr.newWakeLock((PowerManager.SCREEN_BRIGHT_WAKE_LOCK 
    				  | PowerManager.FULL_WAKE_LOCK 
    				  | PowerManager.ACQUIRE_CAUSES_WAKEUP), APPTAG);
    		wakelock.acquire(30000);
        	
    		// Disable keyguard
        	lock.disableKeyguard();
            
            //Toast.makeText(getApplicationContext(), "Lockscreen Disabled", Toast.LENGTH_SHORT).show(); // DEBUG // TODO
            
        	// Enable keyguard after xx seconds..
            keyguardHandler = new Handler(); 
            keyguardHandler.postDelayed(keyguardRunnable, 60000);
            
            // Time..
            timeKeyguardDisabled = System.currentTimeMillis();
            
        }
        //
        else if (action==false) {
        	try { keyguardHandler.removeCallbacks(keyguardRunnable); } catch(Exception e) {}
            lock.reenableKeyguard();
            //Toast.makeText(getApplicationContext(), "Lockscreen Enabled", Toast.LENGTH_SHORT).show(); // DEBUG // TODO
        }
    
    	/**/
    }
    
    // --------------------------------------
    // Others
    
    BroadcastReceiver killAppReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            finish();
        }
    };
    
}

