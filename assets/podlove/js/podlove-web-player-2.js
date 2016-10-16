(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/*!
 *
 * MediaElement.js
 * HTML5 <video> and <audio> shim and player
 * http://mediaelementjs.com/
 *
 * Creates a JavaScript object that mimics HTML5 MediaElement API
 * for browsers that don't understand HTML5 or can't play the provided codec
 * Can play MP4 (H.264), Ogg, WebM, FLV, WMV, WMA, ACC, and MP3
 *
 * Copyright 2010-2014, John Dyer (http://j.hn)
 * License: MIT
 *
 */
// Namespace
var mejs = mejs || {};

// version number
mejs.version = '2.16.4';


// player number (for missing, same id attr)
mejs.meIndex = 0;

// media types accepted by plugins
mejs.plugins = {
	silverlight: [
		{version: [3,0], types: ['video/mp4','video/m4v','video/mov','video/wmv','audio/wma','audio/m4a','audio/mp3','audio/wav','audio/mpeg']}
	],
	flash: [
		{version: [9,0,124], types: ['video/mp4','video/m4v','video/mov','video/flv','video/rtmp','video/x-flv','audio/flv','audio/x-flv','audio/mp3','audio/m4a','audio/mpeg', 'video/youtube', 'video/x-youtube', 'application/x-mpegURL']}
		//,{version: [12,0], types: ['video/webm']} // for future reference (hopefully!)
	],
	youtube: [
		{version: null, types: ['video/youtube', 'video/x-youtube', 'audio/youtube', 'audio/x-youtube']}
	],
	vimeo: [
		{version: null, types: ['video/vimeo', 'video/x-vimeo']}
	]
};

/*
Utility methods
*/
mejs.Utility = {
	encodeUrl: function(url) {
		return encodeURIComponent(url); //.replace(/\?/gi,'%3F').replace(/=/gi,'%3D').replace(/&/gi,'%26');
	},
	escapeHTML: function(s) {
		return s.toString().split('&').join('&amp;').split('<').join('&lt;').split('"').join('&quot;');
	},
	absolutizeUrl: function(url) {
		var el = document.createElement('div');
		el.innerHTML = '<a href="' + this.escapeHTML(url) + '">x</a>';
		return el.firstChild.href;
	},
	getScriptPath: function(scriptNames) {
		var
			i = 0,
			j,
			codePath = '',
			testname = '',
			slashPos,
			filenamePos,
			scriptUrl,
			scriptPath,
			scriptFilename,
			scripts = document.getElementsByTagName('script'),
			il = scripts.length,
			jl = scriptNames.length;

		// go through all <script> tags
		for (; i < il; i++) {
			scriptUrl = scripts[i].src;
			slashPos = scriptUrl.lastIndexOf('/');
			if (slashPos > -1) {
				scriptFilename = scriptUrl.substring(slashPos + 1);
				scriptPath = scriptUrl.substring(0, slashPos + 1);
			} else {
				scriptFilename = scriptUrl;
				scriptPath = '';
			}

			// see if any <script> tags have a file name that matches the
			for (j = 0; j < jl; j++) {
				testname = scriptNames[j];
				filenamePos = scriptFilename.indexOf(testname);
				if (filenamePos > -1) {
					codePath = scriptPath;
					break;
				}
			}

			// if we found a path, then break and return it
			if (codePath !== '') {
				break;
			}
		}

		// send the best path back
		return codePath;
	},
	secondsToTimeCode: function(time, forceHours, showFrameCount, fps) {
		//add framecount
		if (typeof showFrameCount == 'undefined') {
		    showFrameCount=false;
		} else if(typeof fps == 'undefined') {
		    fps = 25;
		}

		var hours = Math.floor(time / 3600) % 24,
			minutes = Math.floor(time / 60) % 60,
			seconds = Math.floor(time % 60),
			frames = Math.floor(((time % 1)*fps).toFixed(3)),
			result =
					( (forceHours || hours > 0) ? (hours < 10 ? '0' + hours : hours) + ':' : '')
						+ (minutes < 10 ? '0' + minutes : minutes) + ':'
						+ (seconds < 10 ? '0' + seconds : seconds)
						+ ((showFrameCount) ? ':' + (frames < 10 ? '0' + frames : frames) : '');

		return result;
	},

	timeCodeToSeconds: function(hh_mm_ss_ff, forceHours, showFrameCount, fps){
		if (typeof showFrameCount == 'undefined') {
		    showFrameCount=false;
		} else if(typeof fps == 'undefined') {
		    fps = 25;
		}

		var tc_array = hh_mm_ss_ff.split(":"),
			tc_hh = parseInt(tc_array[0], 10),
			tc_mm = parseInt(tc_array[1], 10),
			tc_ss = parseInt(tc_array[2], 10),
			tc_ff = 0,
			tc_in_seconds = 0;

		if (showFrameCount) {
		    tc_ff = parseInt(tc_array[3])/fps;
		}

		tc_in_seconds = ( tc_hh * 3600 ) + ( tc_mm * 60 ) + tc_ss + tc_ff;

		return tc_in_seconds;
	},


	convertSMPTEtoSeconds: function (SMPTE) {
		if (typeof SMPTE != 'string')
			return false;

		SMPTE = SMPTE.replace(',', '.');

		var secs = 0,
			decimalLen = (SMPTE.indexOf('.') != -1) ? SMPTE.split('.')[1].length : 0,
			multiplier = 1;

		SMPTE = SMPTE.split(':').reverse();

		for (var i = 0; i < SMPTE.length; i++) {
			multiplier = 1;
			if (i > 0) {
				multiplier = Math.pow(60, i);
			}
			secs += Number(SMPTE[i]) * multiplier;
		}
		return Number(secs.toFixed(decimalLen));
	},

	/* borrowed from SWFObject: http://code.google.com/p/swfobject/source/browse/trunk/swfobject/src/swfobject.js#474 */
	removeSwf: function(id) {
		var obj = document.getElementById(id);
		if (obj && /object|embed/i.test(obj.nodeName)) {
			if (mejs.MediaFeatures.isIE) {
				obj.style.display = "none";
				(function(){
					if (obj.readyState == 4) {
						mejs.Utility.removeObjectInIE(id);
					} else {
						setTimeout(arguments.callee, 10);
					}
				})();
			} else {
				obj.parentNode.removeChild(obj);
			}
		}
	},
	removeObjectInIE: function(id) {
		var obj = document.getElementById(id);
		if (obj) {
			for (var i in obj) {
				if (typeof obj[i] == "function") {
					obj[i] = null;
				}
			}
			obj.parentNode.removeChild(obj);
		}
	}
};


// Core detector, plugins are added below
mejs.PluginDetector = {

	// main public function to test a plug version number PluginDetector.hasPluginVersion('flash',[9,0,125]);
	hasPluginVersion: function(plugin, v) {
		var pv = this.plugins[plugin];
		v[1] = v[1] || 0;
		v[2] = v[2] || 0;
		return (pv[0] > v[0] || (pv[0] == v[0] && pv[1] > v[1]) || (pv[0] == v[0] && pv[1] == v[1] && pv[2] >= v[2])) ? true : false;
	},

	// cached values
	nav: window.navigator,
	ua: window.navigator.userAgent.toLowerCase(),

	// stored version numbers
	plugins: [],

	// runs detectPlugin() and stores the version number
	addPlugin: function(p, pluginName, mimeType, activeX, axDetect) {
		this.plugins[p] = this.detectPlugin(pluginName, mimeType, activeX, axDetect);
	},

	// get the version number from the mimetype (all but IE) or ActiveX (IE)
	detectPlugin: function(pluginName, mimeType, activeX, axDetect) {

		var version = [0,0,0],
			description,
			i,
			ax;

		// Firefox, Webkit, Opera
		if (typeof(this.nav.plugins) != 'undefined' && typeof this.nav.plugins[pluginName] == 'object') {
			description = this.nav.plugins[pluginName].description;
			if (description && !(typeof this.nav.mimeTypes != 'undefined' && this.nav.mimeTypes[mimeType] && !this.nav.mimeTypes[mimeType].enabledPlugin)) {
				version = description.replace(pluginName, '').replace(/^\s+/,'').replace(/\sr/gi,'.').split('.');
				for (i=0; i<version.length; i++) {
					version[i] = parseInt(version[i].match(/\d+/), 10);
				}
			}
		// Internet Explorer / ActiveX
		} else if (typeof(window.ActiveXObject) != 'undefined') {
			try {
				ax = new ActiveXObject(activeX);
				if (ax) {
					version = axDetect(ax);
				}
			}
			catch (e) { }
		}
		return version;
	}
};

// Add Flash detection
mejs.PluginDetector.addPlugin('flash','Shockwave Flash','application/x-shockwave-flash','ShockwaveFlash.ShockwaveFlash', function(ax) {
	// adapted from SWFObject
	var version = [],
		d = ax.GetVariable("$version");
	if (d) {
		d = d.split(" ")[1].split(",");
		version = [parseInt(d[0], 10), parseInt(d[1], 10), parseInt(d[2], 10)];
	}
	return version;
});

// Add Silverlight detection
mejs.PluginDetector.addPlugin('silverlight','Silverlight Plug-In','application/x-silverlight-2','AgControl.AgControl', function (ax) {
	// Silverlight cannot report its version number to IE
	// but it does have a isVersionSupported function, so we have to loop through it to get a version number.
	// adapted from http://www.silverlightversion.com/
	var v = [0,0,0,0],
		loopMatch = function(ax, v, i, n) {
			while(ax.isVersionSupported(v[0]+ "."+ v[1] + "." + v[2] + "." + v[3])){
				v[i]+=n;
			}
			v[i] -= n;
		};
	loopMatch(ax, v, 0, 1);
	loopMatch(ax, v, 1, 1);
	loopMatch(ax, v, 2, 10000); // the third place in the version number is usually 5 digits (4.0.xxxxx)
	loopMatch(ax, v, 2, 1000);
	loopMatch(ax, v, 2, 100);
	loopMatch(ax, v, 2, 10);
	loopMatch(ax, v, 2, 1);
	loopMatch(ax, v, 3, 1);

	return v;
});
// add adobe acrobat
/*
PluginDetector.addPlugin('acrobat','Adobe Acrobat','application/pdf','AcroPDF.PDF', function (ax) {
	var version = [],
		d = ax.GetVersions().split(',')[0].split('=')[1].split('.');

	if (d) {
		version = [parseInt(d[0], 10), parseInt(d[1], 10), parseInt(d[2], 10)];
	}
	return version;
});
*/
// necessary detection (fixes for <IE9)
mejs.MediaFeatures = {
	init: function() {
		var
			t = this,
			d = document,
			nav = mejs.PluginDetector.nav,
			ua = mejs.PluginDetector.ua.toLowerCase(),
			i,
			v,
			html5Elements = ['source','track','audio','video'];

		// detect browsers (only the ones that have some kind of quirk we need to work around)
		t.isiPad = (ua.match(/ipad/i) !== null);
		t.isiPhone = (ua.match(/iphone/i) !== null);
		t.isiOS = t.isiPhone || t.isiPad;
		t.isAndroid = (ua.match(/android/i) !== null);
		t.isBustedAndroid = (ua.match(/android 2\.[12]/) !== null);
		t.isBustedNativeHTTPS = (location.protocol === 'https:' && (ua.match(/android [12]\./) !== null || ua.match(/macintosh.* version.* safari/) !== null));
		t.isIE = (nav.appName.toLowerCase().indexOf("microsoft") != -1 || nav.appName.toLowerCase().match(/trident/gi) !== null);
		t.isChrome = (ua.match(/chrome/gi) !== null);
		t.isChromium = (ua.match(/chromium/gi) !== null);
		t.isFirefox = (ua.match(/firefox/gi) !== null);
		t.isWebkit = (ua.match(/webkit/gi) !== null);
		t.isGecko = (ua.match(/gecko/gi) !== null) && !t.isWebkit && !t.isIE;
		t.isOpera = (ua.match(/opera/gi) !== null);
		t.hasTouch = ('ontouchstart' in window); //  && window.ontouchstart != null); // this breaks iOS 7

		// borrowed from Modernizr
		t.svg = !! document.createElementNS &&
				!! document.createElementNS('http://www.w3.org/2000/svg','svg').createSVGRect;

		// create HTML5 media elements for IE before 9, get a <video> element for fullscreen detection
		for (i=0; i<html5Elements.length; i++) {
			v = document.createElement(html5Elements[i]);
		}

		t.supportsMediaTag = (typeof v.canPlayType !== 'undefined' || t.isBustedAndroid);

		// Fix for IE9 on Windows 7N / Windows 7KN (Media Player not installer)
		try{
			v.canPlayType("video/mp4");
		}catch(e){
			t.supportsMediaTag = false;
		}

		// detect native JavaScript fullscreen (Safari/Firefox only, Chrome still fails)

		// iOS
		t.hasSemiNativeFullScreen = (typeof v.webkitEnterFullscreen !== 'undefined');

		// W3C
		t.hasNativeFullscreen = (typeof v.requestFullscreen !== 'undefined');

		// webkit/firefox/IE11+
		t.hasWebkitNativeFullScreen = (typeof v.webkitRequestFullScreen !== 'undefined');
		t.hasMozNativeFullScreen = (typeof v.mozRequestFullScreen !== 'undefined');
		t.hasMsNativeFullScreen = (typeof v.msRequestFullscreen !== 'undefined');

		t.hasTrueNativeFullScreen = (t.hasWebkitNativeFullScreen || t.hasMozNativeFullScreen || t.hasMsNativeFullScreen);
		t.nativeFullScreenEnabled = t.hasTrueNativeFullScreen;

		// Enabled?
		if (t.hasMozNativeFullScreen) {
			t.nativeFullScreenEnabled = document.mozFullScreenEnabled;
		} else if (t.hasMsNativeFullScreen) {
			t.nativeFullScreenEnabled = document.msFullscreenEnabled;
		}

		if (t.isChrome) {
			t.hasSemiNativeFullScreen = false;
		}

		if (t.hasTrueNativeFullScreen) {

			t.fullScreenEventName = '';
			if (t.hasWebkitNativeFullScreen) {
				t.fullScreenEventName = 'webkitfullscreenchange';

			} else if (t.hasMozNativeFullScreen) {
				t.fullScreenEventName = 'mozfullscreenchange';

			} else if (t.hasMsNativeFullScreen) {
				t.fullScreenEventName = 'MSFullscreenChange';
			}

			t.isFullScreen = function() {
				if (t.hasMozNativeFullScreen) {
					return d.mozFullScreen;

				} else if (t.hasWebkitNativeFullScreen) {
					return d.webkitIsFullScreen;

				} else if (t.hasMsNativeFullScreen) {
					return d.msFullscreenElement !== null;
				}
			}

			t.requestFullScreen = function(el) {

				if (t.hasWebkitNativeFullScreen) {
					el.webkitRequestFullScreen();

				} else if (t.hasMozNativeFullScreen) {
					el.mozRequestFullScreen();

				} else if (t.hasMsNativeFullScreen) {
					el.msRequestFullscreen();

				}
			}

			t.cancelFullScreen = function() {
				if (t.hasWebkitNativeFullScreen) {
					document.webkitCancelFullScreen();

				} else if (t.hasMozNativeFullScreen) {
					document.mozCancelFullScreen();

				} else if (t.hasMsNativeFullScreen) {
					document.msExitFullscreen();

				}
			}

		}


		// OS X 10.5 can't do this even if it says it can :(
		if (t.hasSemiNativeFullScreen && ua.match(/mac os x 10_5/i)) {
			t.hasNativeFullScreen = false;
			t.hasSemiNativeFullScreen = false;
		}

	}
};
mejs.MediaFeatures.init();

/*
extension methods to <video> or <audio> object to bring it into parity with PluginMediaElement (see below)
*/
mejs.HtmlMediaElement = {
	pluginType: 'native',
	isFullScreen: false,

	setCurrentTime: function (time) {
		this.currentTime = time;
	},

	setMuted: function (muted) {
		this.muted = muted;
	},

	setVolume: function (volume) {
		this.volume = volume;
	},

	// for parity with the plugin versions
	stop: function () {
		this.pause();
	},

	// This can be a url string
	// or an array [{src:'file.mp4',type:'video/mp4'},{src:'file.webm',type:'video/webm'}]
	setSrc: function (url) {

		// Fix for IE9 which can't set .src when there are <source> elements. Awesome, right?
		var
			existingSources = this.getElementsByTagName('source');
		while (existingSources.length > 0){
			this.removeChild(existingSources[0]);
		}

		if (typeof url == 'string') {
			this.src = url;
		} else {
			var i, media;

			for (i=0; i<url.length; i++) {
				media = url[i];
				if (this.canPlayType(media.type)) {
					this.src = media.src;
					break;
				}
			}
		}
	},

	setVideoSize: function (width, height) {
		this.width = width;
		this.height = height;
	}
};

/*
Mimics the <video/audio> element by calling Flash's External Interface or Silverlights [ScriptableMember]
*/
mejs.PluginMediaElement = function (pluginid, pluginType, mediaUrl) {
	this.id = pluginid;
	this.pluginType = pluginType;
	this.src = mediaUrl;
	this.events = {};
	this.attributes = {};
};

// JavaScript values and ExternalInterface methods that match HTML5 video properties methods
// http://www.adobe.com/livedocs/flash/9.0/ActionScriptLangRefV3/fl/video/FLVPlayback.html
// http://www.whatwg.org/specs/web-apps/current-work/multipage/video.html
mejs.PluginMediaElement.prototype = {

	// special
	pluginElement: null,
	pluginType: '',
	isFullScreen: false,

	// not implemented :(
	playbackRate: -1,
	defaultPlaybackRate: -1,
	seekable: [],
	played: [],

	// HTML5 read-only properties
	paused: true,
	ended: false,
	seeking: false,
	duration: 0,
	error: null,
	tagName: '',

	// HTML5 get/set properties, but only set (updated by event handlers)
	muted: false,
	volume: 1,
	currentTime: 0,

	// HTML5 methods
	play: function () {
		if (this.pluginApi != null) {
			if (this.pluginType == 'youtube' || this.pluginType == 'vimeo') {
				this.pluginApi.playVideo();
			} else {
				this.pluginApi.playMedia();
			}
			this.paused = false;
		}
	},
	load: function () {
		if (this.pluginApi != null) {
			if (this.pluginType == 'youtube' || this.pluginType == 'vimeo') {
			} else {
				this.pluginApi.loadMedia();
			}

			this.paused = false;
		}
	},
	pause: function () {
		if (this.pluginApi != null) {
			if (this.pluginType == 'youtube' || this.pluginType == 'vimeo') {
				this.pluginApi.pauseVideo();
			} else {
				this.pluginApi.pauseMedia();
			}


			this.paused = true;
		}
	},
	stop: function () {
		if (this.pluginApi != null) {
			if (this.pluginType == 'youtube' || this.pluginType == 'vimeo') {
				this.pluginApi.stopVideo();
			} else {
				this.pluginApi.stopMedia();
			}
			this.paused = true;
		}
	},
	canPlayType: function(type) {
		var i,
			j,
			pluginInfo,
			pluginVersions = mejs.plugins[this.pluginType];

		for (i=0; i<pluginVersions.length; i++) {
			pluginInfo = pluginVersions[i];

			// test if user has the correct plugin version
			if (mejs.PluginDetector.hasPluginVersion(this.pluginType, pluginInfo.version)) {

				// test for plugin playback types
				for (j=0; j<pluginInfo.types.length; j++) {
					// find plugin that can play the type
					if (type == pluginInfo.types[j]) {
						return 'probably';
					}
				}
			}
		}

		return '';
	},

	positionFullscreenButton: function(x,y,visibleAndAbove) {
		if (this.pluginApi != null && this.pluginApi.positionFullscreenButton) {
			this.pluginApi.positionFullscreenButton(Math.floor(x),Math.floor(y),visibleAndAbove);
		}
	},

	hideFullscreenButton: function() {
		if (this.pluginApi != null && this.pluginApi.hideFullscreenButton) {
			this.pluginApi.hideFullscreenButton();
		}
	},


	// custom methods since not all JavaScript implementations support get/set

	// This can be a url string
	// or an array [{src:'file.mp4',type:'video/mp4'},{src:'file.webm',type:'video/webm'}]
	setSrc: function (url) {
		if (typeof url == 'string') {
			this.pluginApi.setSrc(mejs.Utility.absolutizeUrl(url));
			this.src = mejs.Utility.absolutizeUrl(url);
		} else {
			var i, media;

			for (i=0; i<url.length; i++) {
				media = url[i];
				if (this.canPlayType(media.type)) {
					this.pluginApi.setSrc(mejs.Utility.absolutizeUrl(media.src));
					this.src = mejs.Utility.absolutizeUrl(url);
					break;
				}
			}
		}

	},
	setCurrentTime: function (time) {
		if (this.pluginApi != null) {
			if (this.pluginType == 'youtube' || this.pluginType == 'vimeo') {
				this.pluginApi.seekTo(time);
			} else {
				this.pluginApi.setCurrentTime(time);
			}



			this.currentTime = time;
		}
	},
	setVolume: function (volume) {
		if (this.pluginApi != null) {
			// same on YouTube and MEjs
			if (this.pluginType == 'youtube') {
				this.pluginApi.setVolume(volume * 100);
			} else {
				this.pluginApi.setVolume(volume);
			}
			this.volume = volume;
		}
	},
	setMuted: function (muted) {
		if (this.pluginApi != null) {
			if (this.pluginType == 'youtube') {
				if (muted) {
					this.pluginApi.mute();
				} else {
					this.pluginApi.unMute();
				}
				this.muted = muted;
				this.dispatchEvent('volumechange');
			} else {
				this.pluginApi.setMuted(muted);
			}
			this.muted = muted;
		}
	},

	// additional non-HTML5 methods
	setVideoSize: function (width, height) {

		//if (this.pluginType == 'flash' || this.pluginType == 'silverlight') {
			if (this.pluginElement && this.pluginElement.style) {
				this.pluginElement.style.width = width + 'px';
				this.pluginElement.style.height = height + 'px';
			}
			if (this.pluginApi != null && this.pluginApi.setVideoSize) {
				this.pluginApi.setVideoSize(width, height);
			}
		//}
	},

	setFullscreen: function (fullscreen) {
		if (this.pluginApi != null && this.pluginApi.setFullscreen) {
			this.pluginApi.setFullscreen(fullscreen);
		}
	},

	enterFullScreen: function() {
		if (this.pluginApi != null && this.pluginApi.setFullscreen) {
			this.setFullscreen(true);
		}

	},

	exitFullScreen: function() {
		if (this.pluginApi != null && this.pluginApi.setFullscreen) {
			this.setFullscreen(false);
		}
	},

	// start: fake events
	addEventListener: function (eventName, callback, bubble) {
		this.events[eventName] = this.events[eventName] || [];
		this.events[eventName].push(callback);
	},
	removeEventListener: function (eventName, callback) {
		if (!eventName) { this.events = {}; return true; }
		var callbacks = this.events[eventName];
		if (!callbacks) return true;
		if (!callback) { this.events[eventName] = []; return true; }
		for (var i = 0; i < callbacks.length; i++) {
			if (callbacks[i] === callback) {
				this.events[eventName].splice(i, 1);
				return true;
			}
		}
		return false;
	},
	dispatchEvent: function (eventName) {
		var i,
			args,
			callbacks = this.events[eventName];

		if (callbacks) {
			args = Array.prototype.slice.call(arguments, 1);
			for (i = 0; i < callbacks.length; i++) {
				callbacks[i].apply(this, args);
			}
		}
	},
	// end: fake events

	// fake DOM attribute methods
	hasAttribute: function(name){
		return (name in this.attributes);
	},
	removeAttribute: function(name){
		delete this.attributes[name];
	},
	getAttribute: function(name){
		if (this.hasAttribute(name)) {
			return this.attributes[name];
		}
		return '';
	},
	setAttribute: function(name, value){
		this.attributes[name] = value;
	},

	remove: function() {
		mejs.Utility.removeSwf(this.pluginElement.id);
		mejs.MediaPluginBridge.unregisterPluginElement(this.pluginElement.id);
	}
};

// Handles calls from Flash/Silverlight and reports them as native <video/audio> events and properties
mejs.MediaPluginBridge = {

	pluginMediaElements:{},
	htmlMediaElements:{},

	registerPluginElement: function (id, pluginMediaElement, htmlMediaElement) {
		this.pluginMediaElements[id] = pluginMediaElement;
		this.htmlMediaElements[id] = htmlMediaElement;
	},

	unregisterPluginElement: function (id) {
		delete this.pluginMediaElements[id];
		delete this.htmlMediaElements[id];
	},

	// when Flash/Silverlight is ready, it calls out to this method
	initPlugin: function (id) {

		var pluginMediaElement = this.pluginMediaElements[id],
			htmlMediaElement = this.htmlMediaElements[id];

		if (pluginMediaElement) {
			// find the javascript bridge
			switch (pluginMediaElement.pluginType) {
				case "flash":
					pluginMediaElement.pluginElement = pluginMediaElement.pluginApi = document.getElementById(id);
					break;
				case "silverlight":
					pluginMediaElement.pluginElement = document.getElementById(pluginMediaElement.id);
					pluginMediaElement.pluginApi = pluginMediaElement.pluginElement.Content.MediaElementJS;
					break;
			}

			if (pluginMediaElement.pluginApi != null && pluginMediaElement.success) {
				pluginMediaElement.success(pluginMediaElement, htmlMediaElement);
			}
		}
	},

	// receives events from Flash/Silverlight and sends them out as HTML5 media events
	// http://www.whatwg.org/specs/web-apps/current-work/multipage/video.html
	fireEvent: function (id, eventName, values) {

		var
			e,
			i,
			bufferedTime,
			pluginMediaElement = this.pluginMediaElements[id];

		if(!pluginMediaElement){
            return;
        }

		// fake event object to mimic real HTML media event.
		e = {
			type: eventName,
			target: pluginMediaElement
		};

		// attach all values to element and event object
		for (i in values) {
			pluginMediaElement[i] = values[i];
			e[i] = values[i];
		}

		// fake the newer W3C buffered TimeRange (loaded and total have been removed)
		bufferedTime = values.bufferedTime || 0;

		e.target.buffered = e.buffered = {
			start: function(index) {
				return 0;
			},
			end: function (index) {
				return bufferedTime;
			},
			length: 1
		};

		pluginMediaElement.dispatchEvent(e.type, e);
	}
};

/*
Default options
*/
mejs.MediaElementDefaults = {
	// allows testing on HTML5, flash, silverlight
	// auto: attempts to detect what the browser can do
	// auto_plugin: prefer plugins and then attempt native HTML5
	// native: forces HTML5 playback
	// shim: disallows HTML5, will attempt either Flash or Silverlight
	// none: forces fallback view
	mode: 'auto',
	// remove or reorder to change plugin priority and availability
	plugins: ['flash','silverlight','youtube','vimeo'],
	// shows debug errors on screen
	enablePluginDebug: false,
	// use plugin for browsers that have trouble with Basic Authentication on HTTPS sites
	httpsBasicAuthSite: false,
	// overrides the type specified, useful for dynamic instantiation
	type: '',
	// path to Flash and Silverlight plugins
	pluginPath: mejs.Utility.getScriptPath(['mediaelement.js','mediaelement.min.js','mediaelement-and-player.js','mediaelement-and-player.min.js']),
	// name of flash file
	flashName: 'flashmediaelement.swf',
	// streamer for RTMP streaming
	flashStreamer: '',
	// turns on the smoothing filter in Flash
	enablePluginSmoothing: false,
	// enabled pseudo-streaming (seek) on .mp4 files
	enablePseudoStreaming: false,
	// start query parameter sent to server for pseudo-streaming
	pseudoStreamingStartQueryParam: 'start',
	// name of silverlight file
	silverlightName: 'silverlightmediaelement.xap',
	// default if the <video width> is not specified
	defaultVideoWidth: 480,
	// default if the <video height> is not specified
	defaultVideoHeight: 270,
	// overrides <video width>
	pluginWidth: -1,
	// overrides <video height>
	pluginHeight: -1,
	// additional plugin variables in 'key=value' form
	pluginVars: [],
	// rate in milliseconds for Flash and Silverlight to fire the timeupdate event
	// larger number is less accurate, but less strain on plugin->JavaScript bridge
	timerRate: 250,
	// initial volume for player
	startVolume: 0.8,
	success: function () { },
	error: function () { }
};

/*
Determines if a browser supports the <video> or <audio> element
and returns either the native element or a Flash/Silverlight version that
mimics HTML5 MediaElement
*/
mejs.MediaElement = function (el, o) {
	return mejs.HtmlMediaElementShim.create(el,o);
};

mejs.HtmlMediaElementShim = {

	create: function(el, o) {
		var
			options = mejs.MediaElementDefaults,
			htmlMediaElement = (typeof(el) == 'string') ? document.getElementById(el) : el,
			tagName = htmlMediaElement.tagName.toLowerCase(),
			isMediaTag = (tagName === 'audio' || tagName === 'video'),
			src = (isMediaTag) ? htmlMediaElement.getAttribute('src') : htmlMediaElement.getAttribute('href'),
			poster = htmlMediaElement.getAttribute('poster'),
			autoplay =  htmlMediaElement.getAttribute('autoplay'),
			preload =  htmlMediaElement.getAttribute('preload'),
			controls =  htmlMediaElement.getAttribute('controls'),
			playback,
			prop;

		// extend options
		for (prop in o) {
			options[prop] = o[prop];
		}

		// clean up attributes
		src = 		(typeof src == 'undefined' 	|| src === null || src == '') ? null : src;
		poster =	(typeof poster == 'undefined' 	|| poster === null) ? '' : poster;
		preload = 	(typeof preload == 'undefined' 	|| preload === null || preload === 'false') ? 'none' : preload;
		autoplay = 	!(typeof autoplay == 'undefined' || autoplay === null || autoplay === 'false');
		controls = 	!(typeof controls == 'undefined' || controls === null || controls === 'false');

		// test for HTML5 and plugin capabilities
		playback = this.determinePlayback(htmlMediaElement, options, mejs.MediaFeatures.supportsMediaTag, isMediaTag, src);
		playback.url = (playback.url !== null) ? mejs.Utility.absolutizeUrl(playback.url) : '';

		if (playback.method == 'native') {
			// second fix for android
			if (mejs.MediaFeatures.isBustedAndroid) {
				htmlMediaElement.src = playback.url;
				htmlMediaElement.addEventListener('click', function() {
					htmlMediaElement.play();
				}, false);
			}

			// add methods to native HTMLMediaElement
			return this.updateNative(playback, options, autoplay, preload);
		} else if (playback.method !== '') {
			// create plugin to mimic HTMLMediaElement

			return this.createPlugin( playback,  options, poster, autoplay, preload, controls);
		} else {
			// boo, no HTML5, no Flash, no Silverlight.
			this.createErrorMessage( playback, options, poster );

			return this;
		}
	},

	determinePlayback: function(htmlMediaElement, options, supportsMediaTag, isMediaTag, src) {
		var
			mediaFiles = [],
			i,
			j,
			k,
			l,
			n,
			type,
			result = { method: '', url: '', htmlMediaElement: htmlMediaElement, isVideo: (htmlMediaElement.tagName.toLowerCase() != 'audio')},
			pluginName,
			pluginVersions,
			pluginInfo,
			dummy,
			media;

		// STEP 1: Get URL and type from <video src> or <source src>

		// supplied type overrides <video type> and <source type>
		if (typeof options.type != 'undefined' && options.type !== '') {

			// accept either string or array of types
			if (typeof options.type == 'string') {
				mediaFiles.push({type:options.type, url:src});
			} else {

				for (i=0; i<options.type.length; i++) {
					mediaFiles.push({type:options.type[i], url:src});
				}
			}

		// test for src attribute first
		} else if (src !== null) {
			type = this.formatType(src, htmlMediaElement.getAttribute('type'));
			mediaFiles.push({type:type, url:src});

		// then test for <source> elements
		} else {
			// test <source> types to see if they are usable
			for (i = 0; i < htmlMediaElement.childNodes.length; i++) {
				n = htmlMediaElement.childNodes[i];
				if (n.nodeType == 1 && n.tagName.toLowerCase() == 'source') {
					src = n.getAttribute('src');
					type = this.formatType(src, n.getAttribute('type'));
					media = n.getAttribute('media');

					if (!media || !window.matchMedia || (window.matchMedia && window.matchMedia(media).matches)) {
						mediaFiles.push({type:type, url:src});
					}
				}
			}
		}

		// in the case of dynamicly created players
		// check for audio types
		if (!isMediaTag && mediaFiles.length > 0 && mediaFiles[0].url !== null && this.getTypeFromFile(mediaFiles[0].url).indexOf('audio') > -1) {
			result.isVideo = false;
		}


		// STEP 2: Test for playback method

		// special case for Android which sadly doesn't implement the canPlayType function (always returns '')
		if (mejs.MediaFeatures.isBustedAndroid) {
			htmlMediaElement.canPlayType = function(type) {
				return (type.match(/video\/(mp4|m4v)/gi) !== null) ? 'maybe' : '';
			};
		}

		// special case for Chromium to specify natively supported video codecs (i.e. WebM and Theora)
		if (mejs.MediaFeatures.isChromium) {
			htmlMediaElement.canPlayType = function(type) {
				return (type.match(/video\/(webm|ogv|ogg)/gi) !== null) ? 'maybe' : '';
			};
		}

		// test for native playback first
		if (supportsMediaTag && (options.mode === 'auto' || options.mode === 'auto_plugin' || options.mode === 'native')  && !(mejs.MediaFeatures.isBustedNativeHTTPS && options.httpsBasicAuthSite === true)) {

			if (!isMediaTag) {

				// create a real HTML5 Media Element
				dummy = document.createElement( result.isVideo ? 'video' : 'audio');
				htmlMediaElement.parentNode.insertBefore(dummy, htmlMediaElement);
				htmlMediaElement.style.display = 'none';

				// use this one from now on
				result.htmlMediaElement = htmlMediaElement = dummy;
			}

			for (i=0; i<mediaFiles.length; i++) {
				// normal check
				if (mediaFiles[i].type == "video/m3u8" || htmlMediaElement.canPlayType(mediaFiles[i].type).replace(/no/, '') !== ''
					// special case for Mac/Safari 5.0.3 which answers '' to canPlayType('audio/mp3') but 'maybe' to canPlayType('audio/mpeg')
					|| htmlMediaElement.canPlayType(mediaFiles[i].type.replace(/mp3/,'mpeg')).replace(/no/, '') !== ''
					// special case for m4a supported by detecting mp4 support
					|| htmlMediaElement.canPlayType(mediaFiles[i].type.replace(/m4a/,'mp4')).replace(/no/, '') !== '') {
					result.method = 'native';
					result.url = mediaFiles[i].url;
					break;
				}
			}

			if (result.method === 'native') {
				if (result.url !== null) {
					htmlMediaElement.src = result.url;
				}

				// if `auto_plugin` mode, then cache the native result but try plugins.
				if (options.mode !== 'auto_plugin') {
					return result;
				}
			}
		}

		// if native playback didn't work, then test plugins
		if (options.mode === 'auto' || options.mode === 'auto_plugin' || options.mode === 'shim') {
			for (i=0; i<mediaFiles.length; i++) {
				type = mediaFiles[i].type;

				// test all plugins in order of preference [silverlight, flash]
				for (j=0; j<options.plugins.length; j++) {

					pluginName = options.plugins[j];

					// test version of plugin (for future features)
					pluginVersions = mejs.plugins[pluginName];

					for (k=0; k<pluginVersions.length; k++) {
						pluginInfo = pluginVersions[k];

						// test if user has the correct plugin version

						// for youtube/vimeo
						if (pluginInfo.version == null ||

							mejs.PluginDetector.hasPluginVersion(pluginName, pluginInfo.version)) {

							// test for plugin playback types
							for (l=0; l<pluginInfo.types.length; l++) {
								// find plugin that can play the type
								if (type == pluginInfo.types[l]) {
									result.method = pluginName;
									result.url = mediaFiles[i].url;
									return result;
								}
							}
						}
					}
				}
			}
		}

		// at this point, being in 'auto_plugin' mode implies that we tried plugins but failed.
		// if we have native support then return that.
		if (options.mode === 'auto_plugin' && result.method === 'native') {
			return result;
		}

		// what if there's nothing to play? just grab the first available
		if (result.method === '' && mediaFiles.length > 0) {
			result.url = mediaFiles[0].url;
		}

		return result;
	},

	formatType: function(url, type) {
		var ext;

		// if no type is supplied, fake it with the extension
		if (url && !type) {
			return this.getTypeFromFile(url);
		} else {
			// only return the mime part of the type in case the attribute contains the codec
			// see http://www.whatwg.org/specs/web-apps/current-work/multipage/video.html#the-source-element
			// `video/mp4; codecs="avc1.42E01E, mp4a.40.2"` becomes `video/mp4`

			if (type && ~type.indexOf(';')) {
				return type.substr(0, type.indexOf(';'));
			} else {
				return type;
			}
		}
	},

	getTypeFromFile: function(url) {
		url = url.split('?')[0];
		var ext = url.substring(url.lastIndexOf('.') + 1).toLowerCase();
		return (/(mp4|m4v|ogg|ogv|m3u8|webm|webmv|flv|wmv|mpeg|mov)/gi.test(ext) ? 'video' : 'audio') + '/' + this.getTypeFromExtension(ext);
	},

	getTypeFromExtension: function(ext) {

		switch (ext) {
			case 'mp4':
			case 'm4v':
			case 'm4a':
				return 'mp4';
			case 'webm':
			case 'webma':
			case 'webmv':
				return 'webm';
			case 'ogg':
			case 'oga':
			case 'ogv':
				return 'ogg';
			default:
				return ext;
		}
	},

	createErrorMessage: function(playback, options, poster) {
		var
			htmlMediaElement = playback.htmlMediaElement,
			errorContainer = document.createElement('div');

		errorContainer.className = 'me-cannotplay';

		try {
			errorContainer.style.width = htmlMediaElement.width + 'px';
			errorContainer.style.height = htmlMediaElement.height + 'px';
		} catch (e) {}

    if (options.customError) {
      errorContainer.innerHTML = options.customError;
    } else {
      errorContainer.innerHTML = (poster !== '') ?
        '<a href="' + playback.url + '"><img src="' + poster + '" width="100%" height="100%" /></a>' :
        '<a href="' + playback.url + '"><span>' + mejs.i18n.t('Download File') + '</span></a>';
    }

		htmlMediaElement.parentNode.insertBefore(errorContainer, htmlMediaElement);
		htmlMediaElement.style.display = 'none';

		options.error(htmlMediaElement);
	},

	createPlugin:function(playback, options, poster, autoplay, preload, controls) {
		var
			htmlMediaElement = playback.htmlMediaElement,
			width = 1,
			height = 1,
			pluginid = 'me_' + playback.method + '_' + (mejs.meIndex++),
			pluginMediaElement = new mejs.PluginMediaElement(pluginid, playback.method, playback.url),
			container = document.createElement('div'),
			specialIEContainer,
			node,
			initVars;

		// copy tagName from html media element
		pluginMediaElement.tagName = htmlMediaElement.tagName

		// copy attributes from html media element to plugin media element
		for (var i = 0; i < htmlMediaElement.attributes.length; i++) {
			var attribute = htmlMediaElement.attributes[i];
			if (attribute.specified == true) {
				pluginMediaElement.setAttribute(attribute.name, attribute.value);
			}
		}

		// check for placement inside a <p> tag (sometimes WYSIWYG editors do this)
		node = htmlMediaElement.parentNode;
		while (node !== null && node.tagName.toLowerCase() !== 'body' && node.parentNode != null) {
			if (node.parentNode.tagName.toLowerCase() === 'p') {
				node.parentNode.parentNode.insertBefore(node, node.parentNode);
				break;
			}
			node = node.parentNode;
		}

		if (playback.isVideo) {
			width = (options.pluginWidth > 0) ? options.pluginWidth : (options.videoWidth > 0) ? options.videoWidth : (htmlMediaElement.getAttribute('width') !== null) ? htmlMediaElement.getAttribute('width') : options.defaultVideoWidth;
			height = (options.pluginHeight > 0) ? options.pluginHeight : (options.videoHeight > 0) ? options.videoHeight : (htmlMediaElement.getAttribute('height') !== null) ? htmlMediaElement.getAttribute('height') : options.defaultVideoHeight;

			// in case of '%' make sure it's encoded
			width = mejs.Utility.encodeUrl(width);
			height = mejs.Utility.encodeUrl(height);

		} else {
			if (options.enablePluginDebug) {
				width = 320;
				height = 240;
			}
		}

		// register plugin
		pluginMediaElement.success = options.success;
		mejs.MediaPluginBridge.registerPluginElement(pluginid, pluginMediaElement, htmlMediaElement);

		// add container (must be added to DOM before inserting HTML for IE)
		container.className = 'me-plugin';
		container.id = pluginid + '_container';

		if (playback.isVideo) {
				htmlMediaElement.parentNode.insertBefore(container, htmlMediaElement);
		} else {
				document.body.insertBefore(container, document.body.childNodes[0]);
		}

		// flash/silverlight vars
		initVars = [
			'id=' + pluginid,
			'jsinitfunction=' + "mejs.MediaPluginBridge.initPlugin",
			'jscallbackfunction=' + "mejs.MediaPluginBridge.fireEvent",
			'isvideo=' + ((playback.isVideo) ? "true" : "false"),
			'autoplay=' + ((autoplay) ? "true" : "false"),
			'preload=' + preload,
			'width=' + width,
			'startvolume=' + options.startVolume,
			'timerrate=' + options.timerRate,
			'flashstreamer=' + options.flashStreamer,
			'height=' + height,
			'pseudostreamstart=' + options.pseudoStreamingStartQueryParam];

		if (playback.url !== null) {
			if (playback.method == 'flash') {
				initVars.push('file=' + mejs.Utility.encodeUrl(playback.url));
			} else {
				initVars.push('file=' + playback.url);
			}
		}
		if (options.enablePluginDebug) {
			initVars.push('debug=true');
		}
		if (options.enablePluginSmoothing) {
			initVars.push('smoothing=true');
		}
    if (options.enablePseudoStreaming) {
      initVars.push('pseudostreaming=true');
    }
		if (controls) {
			initVars.push('controls=true'); // shows controls in the plugin if desired
		}
		if (options.pluginVars) {
			initVars = initVars.concat(options.pluginVars);
		}

		switch (playback.method) {
			case 'silverlight':
				container.innerHTML =
'<object data="data:application/x-silverlight-2," type="application/x-silverlight-2" id="' + pluginid + '" name="' + pluginid + '" width="' + width + '" height="' + height + '" class="mejs-shim">' +
'<param name="initParams" value="' + initVars.join(',') + '" />' +
'<param name="windowless" value="true" />' +
'<param name="background" value="black" />' +
'<param name="minRuntimeVersion" value="3.0.0.0" />' +
'<param name="autoUpgrade" value="true" />' +
'<param name="source" value="' + options.pluginPath + options.silverlightName + '" />' +
'</object>';
					break;

			case 'flash':

				if (mejs.MediaFeatures.isIE) {
					specialIEContainer = document.createElement('div');
					container.appendChild(specialIEContainer);
					specialIEContainer.outerHTML =
'<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" codebase="//download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab" ' +
'id="' + pluginid + '" width="' + width + '" height="' + height + '" class="mejs-shim">' +
'<param name="movie" value="' + options.pluginPath + options.flashName + '?x=' + (new Date()) + '" />' +
'<param name="flashvars" value="' + initVars.join('&amp;') + '" />' +
'<param name="quality" value="high" />' +
'<param name="bgcolor" value="#000000" />' +
'<param name="wmode" value="transparent" />' +
'<param name="allowScriptAccess" value="always" />' +
'<param name="allowFullScreen" value="true" />' +
'<param name="scale" value="default" />' +
'</object>';

				} else {

					container.innerHTML =
'<embed id="' + pluginid + '" name="' + pluginid + '" ' +
'play="true" ' +
'loop="false" ' +
'quality="high" ' +
'bgcolor="#000000" ' +
'wmode="transparent" ' +
'allowScriptAccess="always" ' +
'allowFullScreen="true" ' +
'type="application/x-shockwave-flash" pluginspage="//www.macromedia.com/go/getflashplayer" ' +
'src="' + options.pluginPath + options.flashName + '" ' +
'flashvars="' + initVars.join('&') + '" ' +
'width="' + width + '" ' +
'height="' + height + '" ' +
'scale="default"' +
'class="mejs-shim"></embed>';
				}
				break;

			case 'youtube':


				var videoId;
				// youtu.be url from share button
				if (playback.url.lastIndexOf("youtu.be") != -1) {
					videoId = playback.url.substr(playback.url.lastIndexOf('/')+1);
					if (videoId.indexOf('?') != -1) {
						videoId = videoId.substr(0, videoId.indexOf('?'));
					}
				}
				else {
					videoId = playback.url.substr(playback.url.lastIndexOf('=')+1);
				}
				youtubeSettings = {
						container: container,
						containerId: container.id,
						pluginMediaElement: pluginMediaElement,
						pluginId: pluginid,
						videoId: videoId,
						height: height,
						width: width
					};

				if (mejs.PluginDetector.hasPluginVersion('flash', [10,0,0]) ) {
					mejs.YouTubeApi.createFlash(youtubeSettings);
				} else {
					mejs.YouTubeApi.enqueueIframe(youtubeSettings);
				}

				break;

			// DEMO Code. Does NOT work.
			case 'vimeo':
				var player_id = pluginid + "_player";
				pluginMediaElement.vimeoid = playback.url.substr(playback.url.lastIndexOf('/')+1);

				container.innerHTML ='<iframe src="//player.vimeo.com/video/' + pluginMediaElement.vimeoid + '?api=1&portrait=0&byline=0&title=0&player_id=' + player_id + '" width="' + width +'" height="' + height +'" frameborder="0" class="mejs-shim" id="' + player_id + '" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>';
				if (typeof($f) == 'function') { // froogaloop available
					var player = $f(container.childNodes[0]);

					player.addEvent('ready', function() {

						player.playVideo = function() {
							player.api( 'play' );
						}
						player.stopVideo = function() {
							player.api( 'unload' );
						}
						player.pauseVideo = function() {
							player.api( 'pause' );
						}
						player.seekTo = function( seconds ) {
							player.api( 'seekTo', seconds );
						}
						player.setVolume = function( volume ) {
							player.api( 'setVolume', volume );
						}
						player.setMuted = function( muted ) {
							if( muted ) {
								player.lastVolume = player.api( 'getVolume' );
								player.api( 'setVolume', 0 );
							} else {
								player.api( 'setVolume', player.lastVolume );
								delete player.lastVolume;
							}
						}

						function createEvent(player, pluginMediaElement, eventName, e) {
							var obj = {
								type: eventName,
								target: pluginMediaElement
							};
							if (eventName == 'timeupdate') {
								pluginMediaElement.currentTime = obj.currentTime = e.seconds;
								pluginMediaElement.duration = obj.duration = e.duration;
							}
							pluginMediaElement.dispatchEvent(obj.type, obj);
						}

						player.addEvent('play', function() {
							createEvent(player, pluginMediaElement, 'play');
							createEvent(player, pluginMediaElement, 'playing');
						});

						player.addEvent('pause', function() {
							createEvent(player, pluginMediaElement, 'pause');
						});

						player.addEvent('finish', function() {
							createEvent(player, pluginMediaElement, 'ended');
						});

						player.addEvent('playProgress', function(e) {
							createEvent(player, pluginMediaElement, 'timeupdate', e);
						});

						pluginMediaElement.pluginElement = container;
						pluginMediaElement.pluginApi = player;

						// init mejs
						mejs.MediaPluginBridge.initPlugin(pluginid);
					});
				}
				else {
					console.warn("You need to include froogaloop for vimeo to work");
				}
				break;
		}
		// hide original element
		htmlMediaElement.style.display = 'none';
		// prevent browser from autoplaying when using a plugin
		htmlMediaElement.removeAttribute('autoplay');

		// FYI: options.success will be fired by the MediaPluginBridge

		return pluginMediaElement;
	},

	updateNative: function(playback, options, autoplay, preload) {

		var htmlMediaElement = playback.htmlMediaElement,
			m;


		// add methods to video object to bring it into parity with Flash Object
		for (m in mejs.HtmlMediaElement) {
			htmlMediaElement[m] = mejs.HtmlMediaElement[m];
		}

		/*
		Chrome now supports preload="none"
		if (mejs.MediaFeatures.isChrome) {

			// special case to enforce preload attribute (Chrome doesn't respect this)
			if (preload === 'none' && !autoplay) {

				// forces the browser to stop loading (note: fails in IE9)
				htmlMediaElement.src = '';
				htmlMediaElement.load();
				htmlMediaElement.canceledPreload = true;

				htmlMediaElement.addEventListener('play',function() {
					if (htmlMediaElement.canceledPreload) {
						htmlMediaElement.src = playback.url;
						htmlMediaElement.load();
						htmlMediaElement.play();
						htmlMediaElement.canceledPreload = false;
					}
				}, false);
			// for some reason Chrome forgets how to autoplay sometimes.
			} else if (autoplay) {
				htmlMediaElement.load();
				htmlMediaElement.play();
			}
		}
		*/

		// fire success code
		options.success(htmlMediaElement, htmlMediaElement);

		return htmlMediaElement;
	}
};

/*
 - test on IE (object vs. embed)
 - determine when to use iframe (Firefox, Safari, Mobile) vs. Flash (Chrome, IE)
 - fullscreen?
*/

// YouTube Flash and Iframe API
mejs.YouTubeApi = {
	isIframeStarted: false,
	isIframeLoaded: false,
	loadIframeApi: function() {
		if (!this.isIframeStarted) {
			var tag = document.createElement('script');
			tag.src = "//www.youtube.com/player_api";
			var firstScriptTag = document.getElementsByTagName('script')[0];
			firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
			this.isIframeStarted = true;
		}
	},
	iframeQueue: [],
	enqueueIframe: function(yt) {

		if (this.isLoaded) {
			this.createIframe(yt);
		} else {
			this.loadIframeApi();
			this.iframeQueue.push(yt);
		}
	},
	createIframe: function(settings) {

		var
		pluginMediaElement = settings.pluginMediaElement,
		player = new YT.Player(settings.containerId, {
			height: settings.height,
			width: settings.width,
			videoId: settings.videoId,
			playerVars: {controls:0},
			events: {
				'onReady': function() {

					// hook up iframe object to MEjs
					settings.pluginMediaElement.pluginApi = player;

					// init mejs
					mejs.MediaPluginBridge.initPlugin(settings.pluginId);

					// create timer
					setInterval(function() {
						mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'timeupdate');
					}, 250);
				},
				'onStateChange': function(e) {

					mejs.YouTubeApi.handleStateChange(e.data, player, pluginMediaElement);

				}
			}
		});
	},

	createEvent: function (player, pluginMediaElement, eventName) {
		var obj = {
			type: eventName,
			target: pluginMediaElement
		};

		if (player && player.getDuration) {

			// time
			pluginMediaElement.currentTime = obj.currentTime = player.getCurrentTime();
			pluginMediaElement.duration = obj.duration = player.getDuration();

			// state
			obj.paused = pluginMediaElement.paused;
			obj.ended = pluginMediaElement.ended;

			// sound
			obj.muted = player.isMuted();
			obj.volume = player.getVolume() / 100;

			// progress
			obj.bytesTotal = player.getVideoBytesTotal();
			obj.bufferedBytes = player.getVideoBytesLoaded();

			// fake the W3C buffered TimeRange
			var bufferedTime = obj.bufferedBytes / obj.bytesTotal * obj.duration;

			obj.target.buffered = obj.buffered = {
				start: function(index) {
					return 0;
				},
				end: function (index) {
					return bufferedTime;
				},
				length: 1
			};

		}

		// send event up the chain
		pluginMediaElement.dispatchEvent(obj.type, obj);
	},

	iFrameReady: function() {

		this.isLoaded = true;
		this.isIframeLoaded = true;

		while (this.iframeQueue.length > 0) {
			var settings = this.iframeQueue.pop();
			this.createIframe(settings);
		}
	},

	// FLASH!
	flashPlayers: {},
	createFlash: function(settings) {

		this.flashPlayers[settings.pluginId] = settings;

		/*
		settings.container.innerHTML =
			'<object type="application/x-shockwave-flash" id="' + settings.pluginId + '" data="//www.youtube.com/apiplayer?enablejsapi=1&amp;playerapiid=' + settings.pluginId  + '&amp;version=3&amp;autoplay=0&amp;controls=0&amp;modestbranding=1&loop=0" ' +
				'width="' + settings.width + '" height="' + settings.height + '" style="visibility: visible; " class="mejs-shim">' +
				'<param name="allowScriptAccess" value="always">' +
				'<param name="wmode" value="transparent">' +
			'</object>';
		*/

		var specialIEContainer,
			youtubeUrl = '//www.youtube.com/apiplayer?enablejsapi=1&amp;playerapiid=' + settings.pluginId  + '&amp;version=3&amp;autoplay=0&amp;controls=0&amp;modestbranding=1&loop=0';

		if (mejs.MediaFeatures.isIE) {

			specialIEContainer = document.createElement('div');
			settings.container.appendChild(specialIEContainer);
			specialIEContainer.outerHTML = '<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" codebase="//download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab" ' +
'id="' + settings.pluginId + '" width="' + settings.width + '" height="' + settings.height + '" class="mejs-shim">' +
	'<param name="movie" value="' + youtubeUrl + '" />' +
	'<param name="wmode" value="transparent" />' +
	'<param name="allowScriptAccess" value="always" />' +
	'<param name="allowFullScreen" value="true" />' +
'</object>';
		} else {
		settings.container.innerHTML =
			'<object type="application/x-shockwave-flash" id="' + settings.pluginId + '" data="' + youtubeUrl + '" ' +
				'width="' + settings.width + '" height="' + settings.height + '" style="visibility: visible; " class="mejs-shim">' +
				'<param name="allowScriptAccess" value="always">' +
				'<param name="wmode" value="transparent">' +
			'</object>';
		}

	},

	flashReady: function(id) {
		var
			settings = this.flashPlayers[id],
			player = document.getElementById(id),
			pluginMediaElement = settings.pluginMediaElement;

		// hook up and return to MediaELementPlayer.success
		pluginMediaElement.pluginApi =
		pluginMediaElement.pluginElement = player;
		mejs.MediaPluginBridge.initPlugin(id);

		// load the youtube video
		player.cueVideoById(settings.videoId);

		var callbackName = settings.containerId + '_callback';

		window[callbackName] = function(e) {
			mejs.YouTubeApi.handleStateChange(e, player, pluginMediaElement);
		}

		player.addEventListener('onStateChange', callbackName);

		setInterval(function() {
			mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'timeupdate');
		}, 250);

		mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'canplay');
	},

	handleStateChange: function(youTubeState, player, pluginMediaElement) {
		switch (youTubeState) {
			case -1: // not started
				pluginMediaElement.paused = true;
				pluginMediaElement.ended = true;
				mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'loadedmetadata');
				//createYouTubeEvent(player, pluginMediaElement, 'loadeddata');
				break;
			case 0:
				pluginMediaElement.paused = false;
				pluginMediaElement.ended = true;
				mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'ended');
				break;
			case 1:
				pluginMediaElement.paused = false;
				pluginMediaElement.ended = false;
				mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'play');
				mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'playing');
				break;
			case 2:
				pluginMediaElement.paused = true;
				pluginMediaElement.ended = false;
				mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'pause');
				break;
			case 3: // buffering
				mejs.YouTubeApi.createEvent(player, pluginMediaElement, 'progress');
				break;
			case 5:
				// cued?
				break;

		}

	}
}
// IFRAME
function onYouTubePlayerAPIReady() {
	mejs.YouTubeApi.iFrameReady();
}
// FLASH
function onYouTubePlayerReady(id) {
	mejs.YouTubeApi.flashReady(id);
}

window.mejs = mejs;
window.MediaElement = mejs.MediaElement;

/*
 * Adds Internationalization and localization to mediaelement.
 *
 * This file does not contain translations, you have to add them manually.
 * The schema is always the same: me-i18n-locale-[IETF-language-tag].js
 *
 * Examples are provided both for german and chinese translation.
 *
 *
 * What is the concept beyond i18n?
 *   http://en.wikipedia.org/wiki/Internationalization_and_localization
 *
 * What langcode should i use?
 *   http://en.wikipedia.org/wiki/IETF_language_tag
 *   https://tools.ietf.org/html/rfc5646
 *
 *
 * License?
 *
 *   The i18n file uses methods from the Drupal project (drupal.js):
 *     - i18n.methods.t() (modified)
 *     - i18n.methods.checkPlain() (full copy)
 *
 *   The Drupal project is (like mediaelementjs) licensed under GPLv2.
 *    - http://drupal.org/licensing/faq/#q1
 *    - https://github.com/johndyer/mediaelement
 *    - http://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 *
 *
 * @author
 *   Tim Latz (latz.tim@gmail.com)
 *
 *
 * @params
 *  - context - document, iframe ..
 *  - exports - CommonJS, window ..
 *
 */
;(function(context, exports, undefined) {
    "use strict";

    var i18n = {
        "locale": {
            // Ensure previous values aren't overwritten.
            "language" : (exports.i18n && exports.i18n.locale.language) || '',
            "strings" : (exports.i18n && exports.i18n.locale.strings) || {}
        },
        "ietf_lang_regex" : /^(x\-)?[a-z]{2,}(\-\w{2,})?(\-\w{2,})?$/,
        "methods" : {}
    };
// start i18n


    /**
     * Get language, fallback to browser's language if empty
     *
     * IETF: RFC 5646, https://tools.ietf.org/html/rfc5646
     * Examples: en, zh-CN, cmn-Hans-CN, sr-Latn-RS, es-419, x-private
     */
    i18n.getLanguage = function () {
        var language = i18n.locale.language || window.navigator.userLanguage || window.navigator.language;
        return i18n.ietf_lang_regex.exec(language) ? language : null;

        //(WAS: convert to iso 639-1 (2-letters, lower case))
        //return language.substr(0, 2).toLowerCase();
    };

    // i18n fixes for compatibility with WordPress
    if ( typeof mejsL10n != 'undefined' ) {
        i18n.locale.language = mejsL10n.language;
    }



    /**
     * Encode special characters in a plain-text string for display as HTML.
     */
    i18n.methods.checkPlain = function (str) {
        var character, regex,
        replace = {
            '&': '&amp;',
            '"': '&quot;',
            '<': '&lt;',
            '>': '&gt;'
        };
        str = String(str);
        for (character in replace) {
            if (replace.hasOwnProperty(character)) {
                regex = new RegExp(character, 'g');
                str = str.replace(regex, replace[character]);
            }
        }
        return str;
    };

    /**
     * Translate strings to the page language or a given language.
     *
     *
     * @param str
     *   A string containing the English string to translate.
     *
     * @param options
     *   - 'context' (defaults to the default context): The context the source string
     *     belongs to.
     *
     * @return
     *   The translated string, escaped via i18n.methods.checkPlain()
     */
    i18n.methods.t = function (str, options) {

        // Fetch the localized version of the string.
        if (i18n.locale.strings && i18n.locale.strings[options.context] && i18n.locale.strings[options.context][str]) {
            str = i18n.locale.strings[options.context][str];
        }

        return i18n.methods.checkPlain(str);
    };


    /**
     * Wrapper for i18n.methods.t()
     *
     * @see i18n.methods.t()
     * @throws InvalidArgumentException
     */
    i18n.t = function(str, options) {

        if (typeof str === 'string' && str.length > 0) {

            // check every time due language can change for
            // different reasons (translation, lang switcher ..)
            var language = i18n.getLanguage();

            options = options || {
                "context" : language
            };

            return i18n.methods.t(str, options);
        }
        else {
            throw {
                "name" : 'InvalidArgumentException',
                "message" : 'First argument is either not a string or empty.'
            };
        }
    };

// end i18n
    exports.i18n = i18n;
}(document, mejs));

// i18n fixes for compatibility with WordPress
;(function(exports, undefined) {

    "use strict";

    if ( typeof mejsL10n != 'undefined' ) {
        exports[mejsL10n.language] = mejsL10n.strings;
    }

}(mejs.i18n.locale.strings));

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../../bower_components/mediaelement/build/mediaelement.js","/../../bower_components/mediaelement/build")
},{"buffer":2,"oMfpAn":5}],2:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `Buffer._useTypedArrays`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (compatible down to IE6)
 */
Buffer._useTypedArrays = (function () {
  // Detect if browser supports Typed Arrays. Supported browsers are IE 10+, Firefox 4+,
  // Chrome 7+, Safari 5.1+, Opera 11.6+, iOS 4.2+. If the browser does not support adding
  // properties to `Uint8Array` instances, then that's the same as no `Uint8Array` support
  // because we need to be able to add all the node Buffer API methods. This is an issue
  // in Firefox 4-29. Now fixed: https://bugzilla.mozilla.org/show_bug.cgi?id=695438
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() &&
        typeof arr.subarray === 'function' // Chrome 9-10 lack `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Workaround: node's base64 implementation allows for non-padded strings
  // while base64-js does not.
  if (encoding === 'base64' && type === 'string') {
    subject = stringtrim(subject)
    while (subject.length % 4 !== 0) {
      subject = subject + '='
    }
  }

  // Find the length
  var length
  if (type === 'number')
    length = coerce(subject)
  else if (type === 'string')
    length = Buffer.byteLength(subject, encoding)
  else if (type === 'object')
    length = coerce(subject.length) // assume that object is array-like
  else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (Buffer._useTypedArrays) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer._useTypedArrays && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    for (i = 0; i < length; i++) {
      if (Buffer.isBuffer(subject))
        buf[i] = subject.readUInt8(i)
      else
        buf[i] = subject[i]
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer._useTypedArrays && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b !== null && b !== undefined && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list, [totalLength])\n' +
      'list should be an Array.')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (typeof totalLength !== 'number') {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

// BUFFER INSTANCE METHODS
// =======================

function _hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  Buffer._charsWritten = i * 2
  return i
}

function _utf8Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function _asciiWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function _binaryWrite (buf, string, offset, length) {
  return _asciiWrite(buf, string, offset, length)
}

function _base64Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function _utf16leWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = _asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = _binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = _base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end !== undefined)
    ? Number(end)
    : end = self.length

  // Fastpath empty strings
  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = _asciiSlice(self, start, end)
      break
    case 'binary':
      ret = _binarySlice(self, start, end)
      break
    case 'base64':
      ret = _base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !Buffer._useTypedArrays) {
    for (var i = 0; i < len; i++)
      target[i + target_start] = this[i + start]
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

function _base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function _utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function _asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++)
    ret += String.fromCharCode(buf[i])
  return ret
}

function _binarySlice (buf, start, end) {
  return _asciiSlice(buf, start, end)
}

function _hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function _utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i+1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = clamp(start, len, 0)
  end = clamp(end, len, len)

  if (Buffer._useTypedArrays) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function _readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return _readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return _readUInt16(this, offset, false, noAssert)
}

function _readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return _readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return _readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function _readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return _readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return _readInt16(this, offset, false, noAssert)
}

function _readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return _readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return _readInt32(this, offset, false, noAssert)
}

function _readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return _readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return _readFloat(this, offset, false, noAssert)
}

function _readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return _readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return _readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
}

function _writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, false, noAssert)
}

function _writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
}

function _writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, false, noAssert)
}

function _writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, false, noAssert)
}

function _writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, false, noAssert)
}

function _writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (typeof value === 'string') {
    value = value.charCodeAt(0)
  }

  assert(typeof value === 'number' && !isNaN(value), 'value is not a number')
  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  for (var i = start; i < end; i++) {
    this[i] = value
  }
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer._useTypedArrays) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1)
        buf[i] = this[i]
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

// slice(start, end)
function clamp (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index;  // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

function coerce (length) {
  // Coerce length to a number (possibly NaN), round up
  // in case it's fractional (e.g. 123.456) then do a
  // double negate to coerce a NaN to 0. Easy, right?
  length = ~~Math.ceil(+length)
  return length < 0 ? 0 : length
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F)
      byteArray.push(str.charCodeAt(i))
    else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++)
        byteArray.push(parseInt(h[j], 16))
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  var pos
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0, 'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/index.js","/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer")
},{"base64-js":3,"buffer":2,"ieee754":4,"oMfpAn":5}],3:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib/b64.js","/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib")
},{"buffer":2,"oMfpAn":5}],4:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/node_modules/ieee754/index.js","/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/node_modules/ieee754")
},{"buffer":2,"oMfpAn":5}],5:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/process/browser.js","/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/process")
},{"buffer":2,"oMfpAn":5}],6:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

/**
 * @type {Tab}
 */
var Tab = require('./tab');
/**
 * @type {Chapters}
 */
var Chapters = require('./modules/chapter');

function createTimeControls() {
  return $('<ul class="timecontrolbar"></ul>');
}

function createBox() {
  return $('<div class="controlbar bar"></div>');
}

function playerStarted(player) {
  return ((typeof player.currentTime === 'number') && (player.currentTime > 0));
}

function getCombinedCallback(callback) {
  return function (evt) {
    console.debug('Controls', 'controlbutton clicked', evt);
    evt.preventDefault();
    console.debug('Controls', 'player started?', playerStarted(this.player));
    if (!playerStarted(this.player)) {
      this.player.play();
    }
    var boundCallBack = callback.bind(this);
    boundCallBack();
  };
}

/**
 * instantiate new controls element
 * @param {jQuery|HTMLElement} player Player element reference
 * @param {Timeline} timeline Timeline object for this player
 * @constructor
 */
function Controls (timeline) {
  this.player = timeline.player;
  this.timeline = timeline;
  this.box = createBox();
  this.timeControlElement = createTimeControls();
  this.box.append(this.timeControlElement);
}

/**
 * create time control buttons and add them to timeControlElement
 * @param {null|Chapters} chapterModule when present will add next and previous chapter controls
 * @returns {void}
 */
Controls.prototype.createTimeControls = function (chapterModule) {
  var hasChapters = (chapterModule instanceof Chapters);
  if (!hasChapters) {
    console.info('Controls', 'createTimeControls', 'no chapterTab found');
  }
  if (hasChapters) {
    this.createButton('pwp-controls-previous-chapter', 'Jump backward to previous chapter', function () {
      var activeChapter = chapterModule.getActiveChapter();
      if (this.timeline.getTime() > activeChapter.start + 10) {
        console.debug('Controls', 'back to chapter start', chapterModule.currentChapter, 'from', this.timeline.getTime());
        return chapterModule.playCurrentChapter();
      }
      console.debug('Controls', 'back to previous chapter', chapterModule.currentChapter);
      return chapterModule.previous();
    });
  }

  this.createButton('pwp-controls-back-30', 'Rewind 30 seconds', function () {
    console.debug('Controls', 'rewind before', this.timeline.getTime());
    this.timeline.setTime(this.timeline.getTime() - 30);
    console.debug('Controls', 'rewind after', this.timeline.getTime());
  });

  this.createButton('pwp-controls-forward-30', 'Fast forward 30 seconds', function () {
    console.debug('Controls', 'ffwd before', this.timeline.getTime());
    this.timeline.setTime(this.timeline.getTime() + 30);
    console.debug('Controls', 'ffwd after', this.timeline.getTime());
  });

  if (hasChapters) {
    this.createButton('pwp-controls-next-chapter', 'Jump to next chapter', function () {
      console.debug('Controls', 'next Chapter before', this.timeline.getTime());
      chapterModule.next();
      console.debug('Controls', 'next Chapter after', this.timeline.getTime());
    });
  }
};

Controls.prototype.createButton = function createButton(icon, title, callback) {
  var button = $('<li><a href="#" class="button button-control" title="' + title + '">' +
    '<i class="icon ' + icon + '"></i></a></li>');
  this.timeControlElement.append(button);
  var combinedCallback = getCombinedCallback(callback);
  button.on('click', combinedCallback.bind(this));
};

module.exports = Controls;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/controls.js","/")
},{"./modules/chapter":9,"./tab":19,"buffer":2,"oMfpAn":5}],7:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

// everything for an embedded player
var
  players = [],
  lastHeight = 0,
  $body;

function postToOpener(obj) {
  console.debug('postToOpener', obj);
  window.parent.postMessage(obj, '*');
}

function messageListener (event) {
  var orig = event.originalEvent;

  if (orig.data.action === 'pause') {
    players.forEach(function (player) {
      player.pause();
    });
  }
}

function waitForMetadata (callback) {
  function metaDataListener (event) {
    var orig = event.originalEvent;
    if (orig.data.playerOptions) {
      callback(orig.data.playerOptions);
    }
  }
  $(window).on('message', metaDataListener);
}

function pollHeight() {
  var newHeight = $body.height();
  if (lastHeight !== newHeight) {
    postToOpener({
      action: 'resize',
      arg: newHeight
    });
  }

  lastHeight = newHeight;
  requestAnimationFrame(pollHeight, document.body);
}

/**
 * initialize embed functionality
 * @param {function} $ jQuery
 * @param {Array} playerList all playersin this window
 * @returns {void}
 */
function init($, playerList) {
  players = playerList;
  $body = $(document.body);
  $(window).on('message', messageListener);
  pollHeight();
}

module.exports = {
  postToOpener: postToOpener,
  waitForMetadata: waitForMetadata,
  init: init
};

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/embed.js","/")
},{"buffer":2,"oMfpAn":5}],8:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/**!
 * ===========================================
 * Podlove Web Player v3.0.0-alpha
 * Licensed under The BSD 2-Clause License
 * http://opensource.org/licenses/BSD-2-Clause
 * ===========================================
 * Copyright (c) 2014, Gerrit van Aaken (https://github.com/gerritvanaaken/), Simon Waldherr (https://github.com/simonwaldherr/), Frank Hase (https://github.com/Kambfhase/), Eric Teubert (https://github.com/eteubert/) and others (https://github.com/podlove/podlove-web-player/contributors)
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 *
 * - Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * - Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
'use strict';

var TabRegistry = require('./tabregistry'),
  embed = require('./embed'),
  Timeline = require('./timeline'),
  Info = require('./modules/info'),
  Share = require('./modules/share'),
  Downloads = require('./modules/downloads'),
  Chapters = require('./modules/chapter'),
  SaveTime = require('./modules/savetime'),
  Controls = require('./controls'),
  Player = require('./player'),
  ProgressBar = require('./modules/progressbar');

var autoplay = false;

var pwp;

// will expose/attach itself to the $ global
require('../../bower_components/mediaelement/build/mediaelement.js');

/**
 * The most missing feature regarding embedded players
 * @param {string} title the title of the show
 * @param {string} url (optional) the link to the show
 * @returns {string}
 */
function renderShowTitle(title, url) {
  if (!title) {
    return '';
  }
  if (url) {
    title = '<a href="' + url + '">' + title + '</a>';
  }
  return '<h3 class="showtitle">' + title + '</h3>';
}

/**
 * Render episode title HTML
 * @param {string} text
 * @param {string} link
 * @returns {string}
 */
function renderTitle(text, link) {
  var titleBegin = '<h1 class="episodetitle">',
    titleEnd = '</h1>';
  if (text !== undefined && link !== undefined) {
    text = '<a href="' + link + '">' + text + '</a>';
  }
  return titleBegin + text + titleEnd;
}

/**
 * Render HTML subtitle
 * @param {string} text
 * @returns {string}
 */
function renderSubTitle(text) {
  if (!text) {
    return '';
  }
  return '<h2 class="subtitle">' + text + '</h2>';
}

/**
 * Render HTML title area
 * @param params
 * @returns {string}
 */
function renderTitleArea(params) {
  return '<header>' +
    renderShowTitle(params.show.title, params.show.url) +
    renderTitle(params.title, params.permalink) +
    renderSubTitle(params.subtitle) +
    '</header>';
}

/**
 * Render HTML playbutton
 * @returns {string}
 */
function renderPlaybutton() {
  return $('<a class="play" title="Play Episode" href="javascript:;"></a>');
}

/**
 * Render the poster image in HTML
 * returns an empty string if posterUrl is empty
 * @param {string} posterUrl
 * @returns {string} rendered HTML
 */
function renderPoster(posterUrl) {
  if (!posterUrl) {
    return '';
  }
  return '<div class="coverart"><img class="coverimg" src="' + posterUrl + '" data-img="' + posterUrl + '" alt="Poster Image"></div>';
}

/**
 * checks if the current window is hidden
 * @returns {boolean} true if the window is hidden
 */
function isHidden() {
  var props = [
    'hidden',
    'mozHidden',
    'msHidden',
    'webkitHidden'
  ];

  for (var index in props) {
    if (props[index] in document) {
      return !!document[props[index]];
    }
  }
  return false;
}

function renderModules(timeline, wrapper, params) {
  var
    tabs = new TabRegistry(),
    hasChapters = timeline.hasChapters,
    controls = new Controls(timeline),
    controlBox = controls.box;

  /**
   * -- MODULES --
   */
  var chapters;
  if (hasChapters) {
    chapters = new Chapters(timeline, params);
    timeline.addModule(chapters);
    chapters.addEventhandlers();
  }
  controls.createTimeControls(chapters);

  var saveTime = new SaveTime(timeline, params);
  timeline.addModule(saveTime);

  var progressBar = new ProgressBar(timeline);
  timeline.addModule(progressBar);

  var sharing = new Share(params);
  var downloads = new Downloads(params);
  var infos = new Info(params);

  /**
   * -- TABS --
   * The tabs in controlbar will appear in following order:
   */

  if (hasChapters) {
    tabs.add(chapters.tab);
  }

  tabs.add(sharing.tab);
  tabs.add(downloads.tab);
  tabs.add(infos.tab);

  tabs.openInitial(params.activeTab);

  // Render controlbar with togglebar and timecontrols
  var controlbarWrapper = $('<div class="controlbar-wrapper"></div>');
  controlbarWrapper.append(tabs.togglebar);
  controlbarWrapper.append(controlBox);

  // render progressbar, controlbar and tabs
  wrapper
    .append(progressBar.render())
    .append(controlbarWrapper)
    .append(tabs.container);

  progressBar.addEvents();
}

/**
 * add chapter behavior and deeplinking: skip to referenced
 * time position & write current time into address
 * @param {object} player
 * @param {object} params
 * @param {object} wrapper
 */
function addBehavior(player, params, wrapper) {
  var jqPlayer = $(player),
    timeline = new Timeline(player, params),

    metaElement = $('<div class="titlebar"></div>'),
    playerType = params.type,
    playButton = renderPlaybutton(),
    poster = params.poster || jqPlayer.attr('poster');

  var deepLink;

  console.debug('webplayer', 'metadata', timeline.getData());
  jqPlayer.prop({
    controls: null,
    preload: 'metadata'
  });

  /**
   * Build rich player with meta data
   */
  wrapper
    .addClass('podlovewebplayer_' + playerType)
    .data('podlovewebplayer', {
    player: jqPlayer
  });

  if (playerType === 'audio') {
    // Render playbutton in titlebar
    metaElement.prepend(playButton);
    metaElement.append(renderPoster(poster));
    wrapper.prepend(metaElement);
  }

  if (playerType === 'video') {
    var videoPane = $('<div class="video-pane"></div>');
    var overlay = $('<div class="video-overlay"></div>');
    overlay.append(playButton);
    overlay.on('click', function () {
      if (player.paused) {
        playButton.addClass('playing');
        player.play();
        return;
      }
      playButton.removeClass('playing');
      player.pause();
    });

    videoPane
      .append(overlay)
      .append(jqPlayer);

    wrapper
      .append(metaElement)
      .append(videoPane);

    jqPlayer.prop({poster: poster});
  }

  // Render title area with title h2 and subtitle h3
  metaElement.append(renderTitleArea(params));

  // parse deeplink
  deepLink = require('./url').checkCurrent();
  if (deepLink[0] && pwp.players.length === 1) {
    var playerAttributes = {preload: 'auto'};
    if (!isHidden()) {
      playerAttributes.autoplay = 'autoplay';
    }
    jqPlayer.attr(playerAttributes);
    //stopAtTime = deepLink[1];
    timeline.playRange(deepLink);

    $('html, body').delay(150).animate({
      scrollTop: $('.container:first').offset().top - 25
    });
  }

  playButton.on('click', function (evt) {
    evt.preventDefault();
    evt.stopPropagation();

    if (player.currentTime && player.currentTime > 0 && !player.paused) {
      playButton.removeClass('playing');
      player.pause();
      if (player.pluginType === 'flash') {
        player.pause();    // flash fallback needs additional pause
      }
      return;
    }

    if (!playButton.hasClass('playing')) {
      playButton.addClass('playing');
    }
    player.play();
  });

  // wait for the player or you'll get DOM EXCEPTIONS
  // And just listen once because of a special behaviour in firefox
  // --> https://bugzilla.mozilla.org/show_bug.cgi?id=664842
  jqPlayer.one('canplay', function (evt) {
    console.debug('canplay', evt);
    timeline.duration = player.duration;
    // attach and render modules
    renderModules(timeline, wrapper, params);
  });

  jqPlayer
    .on('timelineElement', function (event) {
      console.log(event.currentTarget.id, event);
    })
    .on('timeupdate progress', function (event) {
      timeline.update(event);
    })
    // update play/pause status
    .on('play', function () {})
    .on('playing', function () {
      playButton.addClass('playing');
      embed.postToOpener({ action: 'play', arg: player.currentTime });
    })
    .on('pause', function () {
      playButton.removeClass('playing');
      embed.postToOpener({ action: 'pause', arg: player.currentTime });
    })
    .on('ended', function () {
      embed.postToOpener({ action: 'stop', arg: player.currentTime });
      // delete the cached play time
      timeline.rewind();
    });
}

/**
 * return callback function that will attach source elements to the deferred audio element
 * @param {object} deferredPlayer
 * @returns {Function}
 */
function getDeferredPlayerCallBack(deferredPlayer) {
  return function (data) {
    var params = $.extend({}, Player.defaults, data);
    data.sources.forEach(function (sourceObject) {
      $('<source>', sourceObject).appendTo(deferredPlayer);
    });
    Player.create(deferredPlayer, params, addBehavior);
  };
}

/**
 *
 * @param {object} options
 * @returns {jQuery}
 */
$.fn.podlovewebplayer = function webPlayer(options) {
  if (options.deferred) {
    var deferredPlayer = this[0];
    var callback = getDeferredPlayerCallBack(deferredPlayer);
    embed.waitForMetadata(callback);
    embed.postToOpener({action: 'waiting'});
    return this;
  }

  // Additional parameters default values
  var params = $.extend({}, Player.defaults, options);

  // turn each player in the current set into a Podlove Web Player
  return this.each(function (i, playerElement) {
    Player.create(playerElement, params, addBehavior);
  });
};

pwp = { players: Player.players };

embed.init($, Player.players);

window.pwp = pwp;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/fake_799a40d1.js","/")
},{"../../bower_components/mediaelement/build/mediaelement.js":1,"./controls":6,"./embed":7,"./modules/chapter":9,"./modules/downloads":10,"./modules/info":11,"./modules/progressbar":12,"./modules/savetime":13,"./modules/share":14,"./player":15,"./tabregistry":20,"./timeline":22,"./url":23,"buffer":2,"oMfpAn":5}],9:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var tc = require('../timecode')
  , url = require('../url')
  , Tab = require('../tab')
  , Timeline = require('../timeline');

var ACTIVE_CHAPTER_THRESHHOLD = 0.1;

function transformChapter(chapter) {
  chapter.code = chapter.title;
  if (typeof chapter.start === 'string') {
    chapter.start = tc.getStartTimeCode(chapter.start);
  }
  return chapter;
}

/**
 * add `end` property to each simple chapter,
 * needed for proper formatting
 * @param {number} duration
 * @returns {function}
 */
function addEndTime(duration) {
  return function (chapter, i, chapters) {
    var next = chapters[i + 1];
    chapter.end = next ? next.start : duration;
    console.log('duration', duration, chapter.end);
    return chapter;
  };
}

function render(html) {
  return $(html);
}

/**
 * render HTMLTableElement for chapters
 * @returns {jQuery|HTMLElement}
 */
function renderChapterTable() {
  return render(
    '<table class="podlovewebplayer_chapters"><caption>Podcast Chapters</caption>' +
      '<thead>' +
        '<tr>' +
          '<th scope="col">Chapter Number</th>' +
          '<th scope="col">Start time</th>' +
          '<th scope="col">Title</th>' +
          '<th scope="col">Duration</th>' +
        '</tr>' +
      '</thead>' +
      '<tbody></tbody>' +
    '</table>'
  );
}

/**
 *
 * @param {object} chapter
 * @returns {jQuery|HTMLElement}
 */
function renderRow (chapter, index) {
  return render(
    '<tr class="chapter">' +
      '<td class="chapter-number"><span class="badge">' + (index + 1) + '</span></td>' +
      '<td class="chapter-name"><span>' + chapter.code + '</span></td>' +
      '<td class="chapter-duration"><span>' + chapter.duration + '</span></td>' +
    '</tr>'
  );
}

/**
 *
 * @param {Array} chapters
 * @returns {number}
 */
function getMaxChapterStart(chapters) {
  function getStartTime (chapter) {
    return chapter.start;
  }
  return Math.max.apply(Math, $.map(chapters, getStartTime));
}

/**
 *
 * @param {{end:{number}, start:{number}}} chapter
 * @param {number} currentTime
 * @returns {boolean}
 */
function isActiveChapter (chapter, currentTime) {
  if (!chapter) {
    return false;
  }
  return (currentTime > chapter.start - ACTIVE_CHAPTER_THRESHHOLD && currentTime <= chapter.end);
}

/**
 * update the chapter list when the data is loaded
 * @param {Timeline} timeline
 */
function update (timeline) {
  var activeChapter = this.getActiveChapter()
    , currentTime = timeline.getTime();

  console.debug('Chapters', 'update', this, activeChapter, currentTime);
  if (isActiveChapter(activeChapter, currentTime)) {
    console.log('Chapters', 'update', 'already set', this.currentChapter);
    return;
  }
  function markChapter (chapter, i) {
    var isActive = isActiveChapter(chapter, currentTime);
    if (isActive) {
      this.setCurrentChapter(i);
    }
  }
  this.chapters.forEach(markChapter, this);
}

/**
 * chapter handling
 * @params {Timeline} params
 * @return {Chapters} chapter module
 */
function Chapters (timeline, params) {

  if (!timeline || !timeline.hasChapters) {
    return null;
  }
  if (timeline.duration === 0) {
    console.warn('Chapters', 'constructor', 'Zero length media?', timeline);
  }

  this.timeline = timeline;
  this.duration = timeline.duration;
  this.chapterlinks = !!timeline.chapterlinks;
  this.currentChapter = 0;
  this.chapters = this.parseSimpleChapter(params);
  this.data = this.chapters;

  this.tab = new Tab({
    icon: 'pwp-chapters',
    title: 'Show/hide chapters',
    headline: 'Chapters',
    name: 'podlovewebplayer_chapterbox'
  });

  this.tab
    .createMainContent('')
    .append(this.generateTable());

  this.update = update.bind(this);
}

/**
 * Given a list of chapters, this function creates the chapter table for the player.
 * @returns {jQuery|HTMLDivElement}
 */
Chapters.prototype.generateTable = function () {
  var table, tbody, maxchapterstart, forceHours;

  table = renderChapterTable();
  tbody = table.children('tbody');

  if (this.chapterlinks !== 'false') {
    table.addClass('linked linked_' + this.chapterlinks);
  }

  maxchapterstart = getMaxChapterStart(this.chapters);
  forceHours = (maxchapterstart >= 3600);

  function buildChapter(i) {
    var duration = Math.round(this.end - this.start),
      row;
    //make sure the duration for all chapters are equally formatted
    this.duration = tc.generate([duration], false);

    //if there is a chapter that starts after an hour, force '00:' on all previous chapters
    //insert the chapter data
    this.startTime = tc.generate([Math.round(this.start)], true, forceHours);

    row = renderRow(this, i);
    if (i % 2) {
      row.addClass('oddchapter');
    }
    row.appendTo(tbody);
    this.element = row;
  }

  $.each(this.chapters, buildChapter);
  return table;
};

/**
 *
 * @param {mejs.HtmlMediaElement} player
 */
Chapters.prototype.addEventhandlers = function () {
  var player = this.timeline.player;
  function onClick(e) {
    // enable external links to be opened in a new tab or window
    // cancels event to bubble up
    if (e.target.className === 'pwp-outgoing button button-toggle') {
      return true;
    }
    //console.log('chapter#clickHandler: start chapter at', chapterStart);
    e.preventDefault();
    // Basic Chapter Mark function (without deeplinking)
    console.log('Chapter', 'clickHandler', 'setCurrentChapter to', e.data.index);
    e.data.module.setCurrentChapter(e.data.index);
    // flash fallback needs additional pause
    if (player.pluginType === 'flash') {
      player.pause();
    }
    e.data.module.playCurrentChapter();
    return false;
  }

  function addClickHandler (chapter, index) {
    chapter.element.on('click', {module: this, index: index}, onClick);
  }

  this.chapters.forEach(addClickHandler, this);
};

Chapters.prototype.getActiveChapter = function () {
  var active = this.chapters[this.currentChapter];
  console.log('Chapters', 'getActiveChapter', active);
  return active;
};

/**
 *
 * @param {number} chapterIndex
 */
Chapters.prototype.setCurrentChapter = function (chapterIndex) {
  if (chapterIndex < this.chapters.length && chapterIndex >= 0) {
    this.currentChapter = chapterIndex;
  }
  this.markActiveChapter();
  console.log('Chapters', 'setCurrentChapter', 'to', this.currentChapter);
};

Chapters.prototype.markActiveChapter = function () {
  var activeChapter = this.getActiveChapter();
  $.each(this.chapters, function () {
    this.element.removeClass('active');
  });
  activeChapter.element.addClass('active');
};

Chapters.prototype.next = function () {
  var current = this.currentChapter,
    next = this.setCurrentChapter(current + 1);
  if (current === next) {
    console.log('Chapters', 'next', 'already in last chapter');
    return current;
  }
  console.log('Chapters', 'next', 'chapter', this.currentChapter);
  this.playCurrentChapter();
  return next;
};

Chapters.prototype.previous = function () {
  var current = this.currentChapter,
    previous = this.setCurrentChapter(current - 1);
  if (current === previous) {
    console.debug('Chapters', 'previous', 'already in first chapter');
    this.playCurrentChapter();
    return current;
  }
  console.debug('Chapters', 'previous', 'chapter', this.currentChapter);
  this.playCurrentChapter();
  return previous;
};

Chapters.prototype.playCurrentChapter = function () {
  var start = this.getActiveChapter().start;
  console.log('Chapters', '#playCurrentChapter', 'start', start);
  var time = this.timeline.setTime(start);
  console.log('Chapters', '#playCurrentChapter', 'currentTime', time);
};

Chapters.prototype.parseSimpleChapter = function (params) {
  var chapters = params.chapters;
  if (!chapters) {
    return [];
  }

  return chapters
    .map(transformChapter)
    .map(addEndTime(this.duration))
    .sort(function (a, b) { // order is not guaranteed: http://podlove.org/simple-chapters/
      return a.start - b.start;
    });
};

module.exports = Chapters;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/modules/chapter.js","/modules")
},{"../tab":19,"../timecode":21,"../timeline":22,"../url":23,"buffer":2,"oMfpAn":5}],10:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var Tab = require('../tab')
  , timeCode = require('../timecode');

/**
 * Calculate the filesize into KB and MB
 * @param size
 * @returns {string}
 */
function formatSize(size) {
  var oneMb = 1048576;
  var fileSize = parseInt(size, 10);
  var kBFileSize = Math.round(fileSize / 1024);
  var mBFileSIze = Math.round(fileSize / 1024 / 1024);
  if (!size) {
    return ' -- ';
  }
  // in case, the filesize is smaller than 1MB,
  // the format will be rendered in KB
  // otherwise in MB
  return (fileSize < oneMb) ? kBFileSize + ' KB' : mBFileSIze + ' MB';
}

/**
 *
 * @param listElement
 * @returns {string}
 */
function createOption(listElement) {
  console.log(listElement);
  return '<option>' + listElement.assetTitle + ' &#8226; ' + formatSize(listElement.size) + '</option>';
}

function getPosterImage(params) {
  var defaultPoster = '/img/icon-podlove-subscribe-600.png';
  var defaultClass = 'default-poster';

  var poster = defaultPoster;
  if (params.show.poster) {
    poster = params.show.poster;
    defaultClass = '';
  }
  if (params.poster) {
    poster = params.poster;
    defaultClass = '';
  }

  return '<img class="poster-image ' + defaultClass + '" src="' + poster + '" data-img="' + poster + '" ' +
    'alt="Poster Image">';
}

function getPublicationDate(rawDate) {
  if (!rawDate) {
    return '';
  }
  var date = new Date(rawDate);
  return '<p>Published: ' + date.getDate() + '.' + date.getMonth() + '.' + date.getFullYear() + '</p>';
}

/**
 *
 * @param element
 * @returns {{assetTitle: String, downloadUrl: String, url: String, size: Number}}
 */
function normalizeDownload (element) {
  return {
    assetTitle: element.name,
    downloadUrl: element.dlurl,
    url: element.url,
    size: element.size
  };
}

/**
 *
 * @param element
 * @returns {{assetTitle: String, downloadUrl: String, url: String, size: Number}}
 */
function normalizeSource(element) {
  var source = (typeof element === 'string') ? element : element.src;
  var parts = source.split('.');
  return {
    assetTitle: parts[parts.length - 1],
    downloadUrl: source,
    url: source,
    size: -1
  };
}

/**
 *
 * @param {Object} params
 * @returns {Array}
 */
function createList (params) {
  if (params.downloads && params.downloads[0].assetTitle) {
    return params.downloads;
  }

  if (params.downloads) {
    return params.downloads.map(normalizeDownload);
  }
  // build from source elements
  return params.sources.map(normalizeSource);
}

/**
 *
 * @param {object} params
 * @constructor
 */
function Downloads (params) {
  this.list = createList(params);
  this.tab = this.createDownloadTab(params);
}

/**
 *
 * @param {object} params
 * @returns {null|Tab} download tab
 */
Downloads.prototype.createDownloadTab = function (params) {
  if ((!params.downloads && !params.sources) || params.hidedownloadbutton === true) {
    return null;
  }
  var downloadTab = new Tab({
    icon: 'pwp-download',
    title: 'Show/hide download bar',
    name: 'downloads',
    headline: 'Download'
  });

  var $tabContent = downloadTab.createMainContent(
    '<div class="download">' +
    '<form action="" method="">' +
      '<select class="select" name="select-file">' + this.list.map(createOption) + '</select>' +
      '<button class="download button-submit icon pwp-download" name="download-file">' +
      '<span class="download label">Download Episode</span>' +
      '</button>' +
    '</form>'+
    '</div>'
  );
  downloadTab.box.append($tabContent);

  // downloadTab.createFooter('<h3>Direkter Link</h3>').append(linkInput);


  return downloadTab;
};

module.exports = Downloads;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/modules/downloads.js","/modules")
},{"../tab":19,"../timecode":21,"buffer":2,"oMfpAn":5}],11:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var Tab = require('../tab')
  , timeCode = require('../timecode')
  , services = require('../social-networks');

function getPublicationDate(rawDate) {
  if (!rawDate) {
    return '';
  }
  var date = new Date(rawDate);
  return '<p>Published: ' + date.getDate() + '.' + date.getMonth() + '.' + date.getFullYear() + '</p>';
}

function createEpisodeInfo(tab, params) {
  tab.createMainContent(
    '<h2>' + params.title + '</h2>' +
    '<h3>' + params.subtitle + '</h3>' +
    '<p>' + params.summary + '</p>' +
    '<p>Duration: ' + timeCode.fromTimeStamp(params.duration) + '</p>' +
     getPublicationDate(params.publicationDate) +
    '<p>' +
      'Permalink for this episode:<br>' +
      '<a href="' + params.permalink + '">' + params.permalink + '</a>' +
    '</p>'
  );
}

function createPosterImage(poster) {
  if (!poster) {
    return '';
  }
  return '<div class="poster-image">' +
    '<img src="' + poster + '" data-img="' + poster + '" alt="Poster Image">' +
    '</div>';
}

function createSubscribeButton(params) {
  if (!params.subscribeButton) {
    return '';
  }
  return '<button class="button-submit">' +
      '<span class="showtitle-label">' + params.show.title + '</span>' +
      '<span class="submit-label">' + params.subscribeButton + '</span>' +
    '</button>';
}

function createShowInfo (tab, params) {
  tab.createAside(
    '<h2>' + params.show.title + '</h2>' +
    '<h3>' + params.show.subtitle + '</h3>' +
    createPosterImage(params.show.poster) +
    createSubscribeButton(params) +
    '<p>Link to the show:<br>' +
      '<a href="' + params.show.url + '">' + params.show.url + '</a></p>'
  );
}

function createSocialLink(options) {
  var service = services.get(options.serviceName);
  var listItem = $('<li></li>');
  var button = service.getButton(options);
  listItem.append(button.element);
  this.append(listItem);
}

function createSocialInfo(profiles) {
  if (!profiles) {
    return null;
  }

  var profileList = $('<ul></ul>');
  profiles.forEach(createSocialLink, profileList);

  var container = $('<div class="social-links"><h3>Stay in touch</h3></div>');
  container.append(profileList);
  return container;
}

function createSocialAndLicenseInfo (tab, params) {
  if (!params.license && !params.profiles) {
    return;
  }
  tab.createFooter(
    '<p>The show "' + params.show.title + '" is licenced under<br>' +
      '<a href="' + params.license.url + '">' + params.license.name + '</a>' +
    '</p>'
  ).prepend(createSocialInfo(params.profiles));
}

/**
 * create info tab if params.summary is defined
 * @param {object} params parameter object
 * @returns {null|Tab} info tab instance or null
 */
function createInfoTab(params) {
  if (!params.summary) {
    return null;
  }
  var infoTab = new Tab({
    icon: 'pwp-info',
    title: 'More information about this',
    headline: 'Info',
    name: 'info'
  });

  createEpisodeInfo(infoTab, params);
  createShowInfo(infoTab, params);
  createSocialAndLicenseInfo(infoTab, params);

  return infoTab;
}

/**
 * Information module to display podcast and episode info
 * @param {object} params parameter object
 * @constructor
 */
function Info(params) {
  this.tab = createInfoTab(params);
}

module.exports = Info;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/modules/info.js","/modules")
},{"../social-networks":18,"../tab":19,"../timecode":21,"buffer":2,"oMfpAn":5}],12:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var tc = require('../timecode');
var cap = require('../util').cap;

function renderTimeElement(className, time) {
  return $('<div class="time time-' + className + '">' + time + '</div>');
}

/**
 * Render an HTML Element for the current chapter
 * @returns {jQuery|HTMLElement}
 */
function renderCurrentChapterElement() {
  var chapterElement = $('<div class="chapter"></div>');

  if (!this.chapterModule) {
    return chapterElement;
  }

  var index = this.chapterModule.currentChapter;
  var chapter = this.chapterModule.chapters[index];
  console.debug('Progressbar', 'renderCurrentChapterElement', index, chapter);

  this.chapterBadge = $('<span class="badge">' + (index + 1) + '</span>');
  this.chapterTitle = $('<span class="chapter-title">' + chapter.title + '</span>');

  chapterElement
    .append(this.chapterBadge)
    .append(this.chapterTitle);

  return chapterElement;
}

function renderProgressInfo(progressBar) {
  var progressInfo = $('<div class="progress-info"></div>');

  return progressInfo
    .append(progressBar.currentTime)
    .append(renderCurrentChapterElement.call(progressBar))
    .append(progressBar.durationTimeElement);
}

function updateTimes(progressBar) {
  var time = progressBar.timeline.getTime();
  progressBar.currentTime.html(tc.fromTimeStamp(time));

  if (progressBar.showDuration) { return; }

  var remainingTime = Math.abs(time - progressBar.duration);
  progressBar.durationTimeElement.text('-' + tc.fromTimeStamp(remainingTime));
}

function renderDurationTimeElement(progressBar) {
  var formattedDuration = tc.fromTimeStamp(progressBar.duration);
  var durationTimeElement = renderTimeElement('duration', 0);

  durationTimeElement.on('click', function () {
    progressBar.showDuration = !progressBar.showDuration;
    if (progressBar.showDuration) {
      durationTimeElement.text(formattedDuration);
      return;
    }
    updateTimes(progressBar);
  });

  return durationTimeElement;
}

function renderMarkerAt(time) {
  var percent = 100 * time / this.duration;
  return $('<div class="marker" style="left:' + percent + '%;"></div>');
}

function renderChapterMarker(chapter) {
  return renderMarkerAt.call(this, chapter.start);
}

/**
 * This update method is to be called when a players `currentTime` changes.
 */
function update (timeline) {
  this.setProgress(timeline.getTime());
  this.buffer.val(timeline.getBuffered());
  this.setChapter();
}

/**
 * @constructor
 * Creates a new progress bar object.
 * @param {Timeline} timeline - The players timeline to attach to.
 */
function ProgressBar(timeline) {
  if (!timeline) {
    console.error('Timeline missing', arguments);
    return;
  }
  this.timeline = timeline;
  this.duration = timeline.duration;

  this.bar = null;
  this.currentTime = null;

  if (timeline.hasChapters) {
    // FIXME get access to chapterModule reliably
    // this.timeline.getModule('chapters')
    this.chapterModule = this.timeline.modules[0];
    this.chapterBadge = null;
    this.chapterTitle = null;
  }

  this.showDuration = false;
  this.progress = null;
  this.buffer = null;
  this.update = update.bind(this);
}

ProgressBar.prototype.setHandlePosition = function (time) {
  var percent = time / this.duration * 100;
  var newLeftOffset = percent + '%';
  console.debug('ProgressBar', 'setHandlePosition', 'time', time, 'newLeftOffset', newLeftOffset);
  this.handle.css('left', newLeftOffset);
};

/**
 * set progress bar value, slider position and current time
 * @param {number} time
 */
ProgressBar.prototype.setProgress = function (time) {
  this.progress.val(time);
  this.setHandlePosition(time);
  updateTimes(this);
};

/**
 * set chapter title and badge
 */
ProgressBar.prototype.setChapter = function () {
  if (!this.chapterModule) { return; }

  var index = this.chapterModule.currentChapter;
  var chapter = this.chapterModule.chapters[index];
  this.chapterBadge.text(index + 1);
  this.chapterTitle.text(chapter.title);
};

/**
 * Renders a new progress bar jQuery object.
 */
ProgressBar.prototype.render = function () {

  // time elements
  var initialTime = tc.fromTimeStamp(this.timeline.getTime());
  this.currentTime = renderTimeElement('current', initialTime);
  this.durationTimeElement = renderDurationTimeElement(this);

  // progress info
  var progressInfo = renderProgressInfo(this);
  updateTimes(this);

  // timeline and buffer bars
  var progress = $('<div class="progress"></div>');
  var timelineBar = $('<progress class="current"></progress>')
      .attr({ min: 0, max: this.duration});
  var buffer = $('<progress class="buffer"></progress>')
      .attr({min: 0, max: this.duration});
  var handle = $('<div class="handle"><div class="inner-handle"></div></div>');

  progress
    .append(timelineBar)
    .append(buffer)
    .append(handle);

  this.progress = timelineBar;
  this.buffer = buffer;
  this.handle = handle;
  this.setProgress(this.timeline.getTime());

  if (this.chapterModule) {
    var chapterMarkers = this.chapterModule.chapters.map(renderChapterMarker, this);
    chapterMarkers.shift(); // remove first one
    progress.append(chapterMarkers);
  }

  // progress bar
  var bar = $('<div class="progressbar"></div>');
  bar
    .append(progressInfo)
    .append(progress);

  this.bar = bar;
  return bar;
};

ProgressBar.prototype.addEvents = function() {
  var mouseIsDown = false;
  var timeline = this.timeline;
  var progress = this.progress;

  function calculateNewTime (pageX) {
    // mouse position relative to the object
    var width = progress.outerWidth(true);
    var offset = progress.offset();
    var pos = cap(pageX - offset.left, 0, width);
    var percentage = (pos / width);
    return percentage * timeline.duration;
  }

  function handleMouseMove (event) {
    event.preventDefault();
    event.stopPropagation();

    var x = event.pageX;
    if (event.originalEvent.changedTouches) {
      x = event.originalEvent.changedTouches[0].pageX;
    }

    if (typeof timeline.duration !== 'number' || !mouseIsDown ) { return; }
    var newTime = calculateNewTime(x);
    if (newTime === timeline.getTime()) { return; }
    timeline.seek(newTime);
  }

  function handleMouseUp () {
    mouseIsDown = false;
    timeline.seekEnd();
    $(document).unbind('touchend.dur mouseup.dur touchmove.dur mousemove.dur');
  }

  function handleMouseDown (event) {
    if (event.which !== 0 && event.which !== 1) { return; }

    mouseIsDown = true;
    handleMouseMove(event);
    timeline.seekStart();
    $(document)
      .bind('mousemove.dur touchmove.dur', handleMouseMove)
      .bind('mouseup.dur touchend.dur', handleMouseUp);
  }

  // handle click and drag with mouse or touch in progressbar and on handle
  this.progress.bind('mousedown touchstart', handleMouseDown);

  this.handle.bind('touchstart mousedown', handleMouseDown);
};

module.exports = ProgressBar;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/modules/progressbar.js","/modules")
},{"../timecode":21,"../util":24,"buffer":2,"oMfpAn":5}],13:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

/**
 * Saving the playtime
 */
var prefix = 'podlove-web-player-playtime-';

function getItem () {
  return +localStorage[this.key];
}

function removeItem () {
  return localStorage.removeItem(this.key);
}

function hasItem () {
  return (this.key) in localStorage;
}

function update () {
  console.debug('SaveTime', 'update', this.timeline.getTime());
  if (this.timeline.getTime() === 0) {
    return removeItem.call(this);
  }
  this.setItem(this.timeline.getTime());
}

function SaveTime(timeline, params) {
  this.timeline = timeline;
  this.key = prefix + params.permalink;
  this.getItem = getItem.bind(this);
  this.removeItem = removeItem.bind(this);
  this.hasItem = hasItem.bind(this);
  this.update = update.bind(this);

  // set the time on start
  if (this.hasItem()) {
    timeline.setTime(this.getItem());
  }
}

SaveTime.prototype.setItem = function (value) {
  localStorage[this.key] = value;
};

module.exports = SaveTime;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/modules/savetime.js","/modules")
},{"buffer":2,"oMfpAn":5}],14:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var Tab = require('../tab')
  , SocialButtonList = require('../social-button-list');

var services = ['twitter', 'facebook', 'gplus', 'tumblr', 'email']
  , shareOptions = [
    {name: 'Show', value: 'show'},
    {name: 'Episode', value: 'episode', default: true},
    {name: 'Chapter', value: 'chapter', disabled: true},
    {name: 'Exactly this part here', value: 'timed', disabled: true}
  ]
  , shareData = {};

// module globals
var selectedOption, shareButtons, linkInput;

function getShareData(value) {
  if (value === 'show') {
    return shareData.show;
  }
  var data = shareData.episode;
  // todo add chapter start and end time to url
  //if (value === 'chapter') {
  //}
  // todo add selected start and end time to url
  //if (value === 'timed') {
  //}
  return data;
}

function updateUrls(data) {
  shareButtons.update(data);
  linkInput.update(data);
}

function onShareOptionChangeTo (element, value) {
  var data = getShareData(value);

  return function (event) {
    console.log('sharing options changed', value);
    selectedOption.removeClass('selected');
    element.addClass('selected');
    selectedOption = element;
    event.preventDefault();
    updateUrls(data);
  };
}

/**
 * Create html for an poster image
 * @param {string} type 'episode' or 'show'
 * @returns {string} HTML for the image
 */
function createPosterFor(type) {
  var data = shareData[type];
  if (!type || !data || !data.poster) {
    console.warn('cannot create poster for', type);
    return '';
  }
  console.log('create poster for', type, ' > url', data.poster);
  return '<img src="' + data.poster + '" data-img="' + data.poster + '" alt="Poster Image">';
}

/**
 * create sharing button
 * @param {object} option sharing option definition
 * @returns {jQuery} share button reference
 */
function createOption(option) {
  if (option.disabled) {
    console.log('Share', 'createOption', 'omit disabled option', option.name);
    return null;
  }

  var data = getShareData(option.value);

  if (!data) {
    console.log('Share', 'createOption', 'omit option without data', option.name);
    return null;
  }

  var element = $('<div class="share-select-option">' + createPosterFor(option.value) +
      '<span>Share this ' + option.name + '</span>' +
    '</div>');

  if (option.default) {
    selectedOption = element;
    element.addClass('selected');
    updateUrls(data);
  }
  element.on('click', onShareOptionChangeTo(element, option.value));
  return element;
}

/**
 * Creates an html div element to wrap all share buttons
 * @returns {jQuery|HTMLElement} share button wrapper reference
 */
function createShareButtonWrapper() {
  var div = $('<div class="share-button-wrapper"></div>');
  div.append(shareOptions.map(createOption));

  return div;
}

/**
 * create sharing buttons in a form
 * @returns {jQuery} form element reference
 */
function createShareOptions() {
  var form = $('<form>' +
    '<legend>What would you like to share?</legend>' +
  '</form>');
  form.append(createShareButtonWrapper);
  return form;
}

/**
 * build and return tab instance for sharing
 * @param {object} params player configuration
 * @returns {null|Tab} sharing tab instance or null if permalink missing or sharing disabled
 */
function createShareTab(params) {
  if (!params.permalink || params.hidesharebutton === true) {
    return null;
  }

  var shareTab = new Tab({
    icon: 'pwp-share',
    title: 'Show/hide sharing tabs',
    name: 'podlovewebplayer_share',
    headline: 'Share'
  });

  shareButtons = new SocialButtonList(services, getShareData('episode'));
  linkInput = $('<h3>Link</h3>' +
    '<input type="url" name="share-link-url" readonly>');
  linkInput.update = function(data) {
    this.val(data.rawUrl);
  };

  shareTab.createMainContent('').append(createShareOptions());
  shareTab.createFooter('<h3>Share via ...</h3>').append(shareButtons.list).append(linkInput);

  return shareTab;
}

module.exports = function Share(params) {
  shareData.episode = {
    poster: params.poster,
    title: encodeURIComponent(params.title),
    url: encodeURIComponent(params.permalink),
    rawUrl: params.permalink,
    text: encodeURIComponent(params.title + ' ' + params.permalink)
  };
  shareData.chapters = params.chapters;

  if (params.show.url) {
    shareData.show = {
      poster: params.show.poster,
      title: encodeURIComponent(params.show.title),
      url: encodeURIComponent(params.show.url),
      rawUrl: params.show.url,
      text: encodeURIComponent(params.show.title + ' ' + params.show.url)
    };
  }

  selectedOption = 'episode';
  this.tab = createShareTab(params);
};

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/modules/share.js","/modules")
},{"../social-button-list":16,"../tab":19,"buffer":2,"oMfpAn":5}],15:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var embed = require('./embed'),
  parseTimecode = require('./timecode').parse;

/**
 * player
 */
var
// Keep all Players on site - for inline players
// embedded players are registered in podlove-webplayer-moderator in the embedding page
  players = [],
// all used functions
  mejsoptions = {
    defaultVideoWidth: 480,
    defaultVideoHeight: 270,
    videoWidth: -1,
    videoHeight: -1,
    audioWidth: -1,
    audioHeight: 30,
    startVolume: 0.8,
    loop: false,
    enableAutosize: true,
    features: ['playpause', 'current', 'progress', 'duration', 'tracks', 'fullscreen'],
    alwaysShowControls: false,
    iPadUseNativeControls: false,
    iPhoneUseNativeControls: false,
    AndroidUseNativeControls: false,
    alwaysShowHours: false,
    showTimecodeFrameCount: false,
    framesPerSecond: 25,
    enableKeyboard: true,
    pauseOtherPlayers: true,
    duration: false,
    plugins: ['flash', 'silverlight'],
    pluginPath: './bin/',
    flashName: 'flashmediaelement.swf',
    silverlightName: 'silverlightmediaelement.xap'
  },
  defaults = {
    chapterlinks: 'all',
    width: '100%',
    duration: false,
    chaptersVisible: false,
    timecontrolsVisible: false,
    sharebuttonsVisible: false,
    downloadbuttonsVisible: false,
    summaryVisible: false,
    hidetimebutton: false,
    hidedownloadbutton: false,
    hidesharebutton: false,
    sharewholeepisode: false,
    sources: []
  };

/**
 * remove 'px' unit, set witdth to 100% for 'auto'
 * @param {string} width
 * @returns {string}
 */
function normalizeWidth(width) {
  if (width.toLowerCase() === 'auto') {
    return '100%';
  }
  return width.replace('px', '');
}

/**
 * audio or video tag
 * @param {HTMLElement} player
 * @returns {string} 'audio' | 'video'
 */
function getPlayerType (player) {
  return player.tagName.toLowerCase();
}

/**
 * kill play/pause button from miniplayer
 * @param options
 */
function removePlayPause(options) {
  $.each(options.features, function (i) {
    if (this === 'playpause') {
      options.features.splice(i, 1);
    }
  });
}

/**
 * player error handling function
 * will remove the topmost mediafile from src or source list
 * possible fix for Firefox AAC issues
 */
function removeUnplayableMedia() {
  var $this = $(this);
  if ($this.attr('src')) {
    $this.removeAttr('src');
    return;
  }
  var sourceList = $this.children('source');
  if (sourceList.length) {
    sourceList.first().remove();
  }
}

function create(player, params, callback) {
  var jqPlayer,
    playerType = getPlayerType(player),
    secArray,
    wrapper;

  jqPlayer = $(player);
  wrapper = $('<div class="container"></div>');
  jqPlayer.replaceWith(wrapper);

  //fine tuning params
  params.width = normalizeWidth(params.width);
  if (playerType === 'audio') {
    // FIXME: Since the player is no longer visible it has no width
    if (params.audioWidth !== undefined) {
      params.width = params.audioWidth;
    }
    mejsoptions.audioWidth = params.width;
    //kill fullscreen button
    $.each(mejsoptions.features, function (i) {
      if (this === 'fullscreen') {
        mejsoptions.features.splice(i, 1);
      }
    });
    removePlayPause(mejsoptions);
  }
  else if (playerType === 'video') {
    //video params
    if (false && params.height !== undefined) {
      mejsoptions.videoWidth = params.width;
      mejsoptions.videoHeight = params.height;
    }
    // FIXME
    if (false && $(player).attr('width') !== undefined) {
      params.width = $(player).attr('width');
    }
  }

  //duration can be given in seconds or in NPT format
  if (params.duration && params.duration !== parseInt(params.duration, 10)) {
    secArray = parseTimecode(params.duration);
    params.duration = secArray[0];
  }

  //Overwrite MEJS default values with actual data
  $.each(mejsoptions, function (key) {
    if (key in params) {
      mejsoptions[key] = params[key];
    }
  });

  //wrapper and init stuff
  // FIXME: better check for numerical value
  if (params.width.toString().trim() === parseInt(params.width, 10).toString()) {
    params.width = parseInt(params.width, 10) + 'px';
  }

  players.push(player);

  //add params from audio and video elements
  jqPlayer.find('source').each(function () {
    if (!params.sources) {
      params.sources = [];
    }
    params.sources.push($(this).attr('src'));
  });

  params.type = playerType;
  // init MEJS to player
  mejsoptions.success = function (playerElement) {
    jqPlayer.on('error', removeUnplayableMedia);   // This might be a fix to some Firefox AAC issues.
    callback(playerElement, params, wrapper);
  };
  var me = new MediaElement(player, mejsoptions);
  console.log('MediaElement', me);
}

module.exports = {
  create: create,
  defaults: defaults,
  players: players
};

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/player.js","/")
},{"./embed":7,"./timecode":21,"buffer":2,"oMfpAn":5}],16:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var socialNetworks = require('./social-networks');

function createButtonWith(options) {
  return function (serviceName) {
    var service = socialNetworks.get(serviceName);
    return service.getButton(options);
  };
}

function SocialButtonList (services, options) {
  var createButton = createButtonWith(options);
  this.buttons = services.map(createButton);

  this.list = $('<ul></ul>');
  this.buttons.forEach(function (button) {
    var listElement = $('<li></li>').append(button.element);
    this.list.append(listElement);
  }, this);
}

SocialButtonList.prototype.update = function (options) {
  this.buttons.forEach(function (button) {
    button.updateUrl(options);
  });
};

module.exports = SocialButtonList;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/social-button-list.js","/")
},{"./social-networks":18,"buffer":2,"oMfpAn":5}],17:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

function createButton (options) {
  return $('<a class="pwp-contrast-' + options.icon + '" target="_blank" href="' + options.url + '" ' +
  'title="' + options.title + '"><i class="icon pwp-' + options.icon + '"></i></a>' +
  '<span>' + options.title + '</span>');
}

/**
 * Creates an object to interact with a social network
 * @param {object} options Icon, title profile- and sharing-URL-templates
 * @constructor
 */
function SocialNetwork (options) {
  this.icon = options.icon;
  this.title = options.title;
  this.url = options.profileUrl;
  this.shareUrl = options.shareUrl;
}

/**
 * build URL for sharing a text, a title and a url
 * @param {object} options contents to be shared
 * @returns {string} URL to share the contents
 */
SocialNetwork.prototype.getShareUrl = function (options) {
  var shareUrl = this.shareUrl
    .replace('$text$', options.text)
    .replace('$title$', options.title)
    .replace('$url$', options.url);
  return this.url + shareUrl;
};

/**
 * build URL to a given profile
 * @param {object} profile Username to link to
 * @returns {string} profile URL
 */
SocialNetwork.prototype.getProfileUrl = function (profile) {
  return this.url + profile;
};

/**
 * get profile button element
 * @param {object} options options.profile defines the profile the button links to
 * @returns {{element:{jQuery}}} button reference
 */
SocialNetwork.prototype.getProfileButton = function (options) {
  if (!options.profile) {
    return null;
  }
  return {
    element: createButton({
      url: this.getProfileUrl(options.profile),
      title: this.title,
      icon: this.icon
    })
  };
};

/**
 * get share button element and URL update function
 * @param {object} options initial contents to be shared with the button
 * @returns {{element:{jQuery}, updateUrl:{function}}} button reference and update function
 */
SocialNetwork.prototype.getShareButton = function (options) {

  if (!this.shareUrl || !options.title || !options.url) {
    return null;
  }

  if (!options.text) {
    options.text = options.title + '%20' + options.url;
  }

  var element = createButton({
    url: this.getShareUrl(options),
    title: this.title,
    icon: this.icon
  });

  var updateUrl = function (updateOptions) {
    element.get(0).href = this.getShareUrl(updateOptions);
  }.bind(this);

  return {
    element: element,
    updateUrl: updateUrl
  };
};

/**
 * get share or profile button depending on the options given
 * @param {object} options object with either profilename or contents to share
 * @returns {object} button object
 */
SocialNetwork.prototype.getButton = function (options) {
  if (options.profile) {
    return this.getProfileButton(options);
  }
  if (this.shareUrl && options.title && options.url) {
    return this.getShareButton(options);
  }
  return null;
};

module.exports = SocialNetwork;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/social-network.js","/")
},{"buffer":2,"oMfpAn":5}],18:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var SocialNetwork = require('./social-network');
var socialNetworks = {
  twitter: new SocialNetwork({
    icon: 'twitter',
    title: 'Twitter',
    profileUrl: 'https://twitter.com/',
    shareUrl: 'share?text=$text$&url=$url$'
  }),

  flattr: new SocialNetwork({
    icon: 'flattr',
    title: 'Flattr',
    profileUrl: 'https://flattr.com/profile/',
    shareUrl: 'share?text=$text$&url=$url$'
  }),

  facebook: new SocialNetwork({
    icon: 'facebook',
    title: 'Facebook',
    profileUrl: 'https://facebook.com/',
    shareUrl: 'share.php?t=$text$&u=$url$'
  }),

  adn: new SocialNetwork({
    icon: 'adn',
    title: 'App.net',
    profileUrl: 'https://alpha.app.net/',
    shareUrl: 'intent/post?text=$text$'
  }),

  soundcloud: new SocialNetwork({
    icon: 'soundcloud',
    title: 'SoundCloud',
    profileUrl: 'https://soundcloud.com/',
    shareUrl: 'share?title=$title$&url=$url$'
  }),

  instagram: new SocialNetwork({
    icon: 'instagram',
    title: 'Instagram',
    profileUrl: 'http://instagram.com/',
    shareUrl: 'share?title=$title$&url=$url$'
  }),

  tumblr: new SocialNetwork({
    icon: 'tumblr',
    title: 'Tumblr',
    profileUrl: 'https://www.tumblr.com/',
    shareUrl: 'share?title=$title$&url=$url$'
  }),

  email: new SocialNetwork({
    icon: 'message',
    title: 'E-Mail',
    profileUrl: 'mailto:',
    shareUrl: '?subject=$title$&body=$text$'
  }),
  gplus: new SocialNetwork({
    icon: 'google-plus',
    title: 'Google+',
    profileUrl: 'https://plus.google.com/',
    shareUrl: 'share?title=$title$&url=$url$'
  })
};

/**
 * returns the service registered with the given name
 * @param {string} serviceName The name of the social network
 * @returns {SocialNetwork} The network with the given name
 */
function getService (serviceName) {
  var service = socialNetworks[serviceName];
  if (!service) {
    console.error('Unknown service', serviceName);
  }
  return service;
}

module.exports = {
  get: getService
};

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/social-networks.js","/")
},{"./social-network":17,"buffer":2,"oMfpAn":5}],19:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

/**
 * When tab content is scrolled, a boxshadow is added to the header
 * @param event
 */
function addShadowOnScroll(event) {
  var scroll = event.currentTarget.scrollTop;
  event.data.header.toggleClass('scrolled', (scroll >= 5 ));
}

/**
 * Return an html section element as a wrapper for the tab
 * @param {object} options
 * @returns {*|jQuery|HTMLElement}
 */
function createContentBox(options) {
  var classes = ['tab'];
  classes.push(options.name);
  if (options.active) {
    classes.push('active');
  }
  return $('<section class="' + classes.join(' ') + '"></section>');
}

/**
 * Create a tab
 * @param options
 * @constructor
 */
function Tab(options) {
  this.icon = options.icon;
  this.title = options.title;
  this.headline = options.headline;

  this.box = createContentBox(options);
  var header = this.createHeader();
  this.box.on('scroll', {header: header}, addShadowOnScroll);

  this.active = false;
  this.toggle = null;
}

/**
 * Add class 'active' to the active tab
 */
Tab.prototype.open = function () {
  this.active = true;
  this.box.addClass('active');
  this.toggle.addClass('active');
};

/**
 * Remove class 'active' from the inactive tab
 */
Tab.prototype.close = function () {
  this.active = false;
  this.box.removeClass('active');
  this.toggle.removeClass('active');
};

/**
 * Return an html header element with a headline
 */
Tab.prototype.createHeader = function() {
  var header = $('<header class="tab-header"><h2 class="tab-headline">' +
    '<i class="icon ' + this.icon + '"></i>' + this.headline + '</h2></header>');
  this.box.append(header);
  return header;
};

/**
 * Append an html div element with class main to the tab's content box
 * @param content
 */
Tab.prototype.createMainContent = function(content) {
  var mainDiv = $('<div class="main">' + content + '</div');
  this.box.append(mainDiv);
  return mainDiv;
};

/**
 * Append an html aside element to the tab's content box
 * @param content
 */
Tab.prototype.createAside = function(content) {
  var aside = $('<aside class="aside">' + content + '</aside>');
  this.box.append(aside);
  return aside;
};

/**
 * Append an html footer element to the tab's content box
 * @param content
 */
Tab.prototype.createFooter = function(content) {
  var footer = $('<footer>' + content + '</footer>');
  this.box.append(footer);
  return footer;
};

module.exports = Tab;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/tab.js","/")
},{"buffer":2,"oMfpAn":5}],20:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

/**
 * @type {Tab}
 */
var Tab = require('./tab.js');

/**
 *
 * @param {Tab} tab
 * @returns {boolean}
 */
function getToggleClickHandler(tab) {
  /*jshint validthis:true */
  console.debug('TabRegistry', 'activeTab', this.activeTab);
  if (this.activeTab) {
    this.activeTab.close();
  }
  if (this.activeTab === tab) {
    this.activeTab = null;
    return false;
  }
  this.activeTab = tab;
  this.activeTab.open();
  return false;
}

/**
 *
 * @param {HTMLElement} player
 */
function logCurrentTime (player) {
  console.log('player.currentTime', player.currentTime);
}

function TabRegistry() {
  /**
   * will store a reference to currently active tab instance to close it when another one is opened
   * @type {object}
   */
  this.activeTab = null;
  this.togglebar = $('<div class="togglebar bar"></div>');
  this.toggleList = $('<ul class="tablist"></ul>');
  this.togglebar.append(this.toggleList);
  this.container = $('<div class="tabs"></div>');
  this.listeners = [logCurrentTime];
  this.tabs = [];
}

TabRegistry.prototype.createToggleFor = function (tab) {
  var toggle = $('<li title="' + tab.title + '">' +
      '<a href="javascript:;" class="button button-toggle ' + tab.icon + '"></a>' +
    '</li>');
  toggle.on('click', getToggleClickHandler.bind(this, tab));
  this.toggleList.append(toggle);
  return toggle;
};

/**
 * Register a tab and open it if it is initially visible
 * @param {Tab} tab
 * @param {Boolean} visible
 */
TabRegistry.prototype.add = function(tab) {
  if (tab === null) { return; }
  this.tabs.push(tab);
  this.container.append(tab.box);
  tab.toggle = this.createToggleFor(tab);
};

TabRegistry.prototype.openInitial = function (tabName) {
  var matchingTabs = this.tabs.filter(function (tab) {
    return (tab.headline === tabName);
  });
  if (matchingTabs.length > 0) {
    matchingTabs.pop().open();
  }
};

/**
 *
 * @param {object} module
 */
TabRegistry.prototype.addModule = function(module) {
  if (module.tab) {
    this.add(module.tab);
  }
  if (module.update) {
    this.listeners.push(module.update);
  }
};

TabRegistry.prototype.update = function(event) {
  console.log('TabRegistry#update', event);
  var player = event.currentTarget;
  $.each(this.listeners, function (i, listener) { listener(player); });
};

module.exports = TabRegistry;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/tabregistry.js","/")
},{"./tab.js":19,"buffer":2,"oMfpAn":5}],21:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var zeroFill = require('./util').zeroFill;

/**
 * Timecode as described in http://podlove.org/deep-link/
 * and http://www.w3.org/TR/media-frags/#fragment-dimensions
 */
var timeCodeMatcher = /(?:(\d+):)?(\d{1,2}):(\d\d)(\.\d{1,3})?/;

/**
 * convert an array of string to timecode
 * @param {string} tc
 * @returns {number|boolean}
 */
function extractTime(tc) {
  if (!tc) {
    return false;
  }
  var parts = timeCodeMatcher.exec(tc);
  if (!parts) {
    console.warn('Could not extract time from', tc);
    return false;
  }
  var time = 0;
  // hours
  time += parts[1] ? parseInt(parts[1], 10) * 60 * 60 : 0;
  // minutes
  time += parseInt(parts[2], 10) * 60;
  // seconds
  time += parseInt(parts[3], 10);
  // milliseconds
  time += parts[4] ? parseFloat(parts[4]) : 0;
  // no negative time
  time = Math.max(time, 0);
  return time;
}

/**
 * convert a timestamp to a timecode in ${insert RFC here} format
 * @param {Number} time
 * @param {Boolean} leadingZeros
 * @param {Boolean} [forceHours] force output of hours, defaults to false
 * @param {Boolean} [showMillis] output milliseconds separated with a dot from the seconds - defaults to false
 * @return {string}
 */
function ts2tc(time, leadingZeros, forceHours, showMillis) {
  var hours, minutes, seconds, milliseconds;
  var timecode = '';

  if (time === 0) {
    return (forceHours ? '00:00:00' : '00:00');
  }

  // prevent negative values from player
  if (!time || time <= 0) {
    return (forceHours ? '--:--:--' : '--:--');
  }

  hours = Math.floor(time / 60 / 60);
  minutes = Math.floor(time / 60) % 60;
  seconds = Math.floor(time % 60) % 60;
  milliseconds = Math.floor(time % 1 * 1000);

  if (showMillis && milliseconds) {
    timecode = '.' + zeroFill(milliseconds, 3);
  }

  timecode = ':' + zeroFill(seconds, 2) + timecode;

  if (hours === 0 && !forceHours && !leadingZeros ) {
    return minutes.toString() + timecode;
  }

  timecode = zeroFill(minutes, 2) + timecode;

  if (hours === 0 && !forceHours) {
    // required (minutes : seconds)
    return timecode;
  }

  if (leadingZeros) {
    return zeroFill(hours, 2) + ':' + timecode;
  }

  return hours + ':' + timecode;
}

module.exports = {

  /**
   * convenience method for converting timestamps to
   * @param {Number} timestamp
   * @returns {String} timecode
   */
  fromTimeStamp: function (timestamp) {
    return ts2tc(timestamp, true, true);
  },

  /**
   * accepts array with start and end time in seconds
   * returns timecode in deep-linking format
   * @param {Array} times
   * @param {Boolean} leadingZeros
   * @param {Boolean} [forceHours]
   * @return {string}
   */
  generate: function (times, leadingZeros, forceHours) {
    if (times[1] > 0 && times[1] < 9999999 && times[0] < times[1]) {
      return ts2tc(times[0], leadingZeros, forceHours) + ',' + ts2tc(times[1], leadingZeros, forceHours);
    }
    return ts2tc(times[0], leadingZeros, forceHours);
  },

  /**
   * parses time code into seconds
   * @param {String} timecode
   * @return {Array}
   */
  parse: function (timecode) {
    if (!timecode) {
      return [false, false];
    }

    var timeparts = timecode.split('-');

    if (!timeparts.length) {
      console.warn('no timeparts:', timecode);
      return [false, false];
    }

    var startTime = extractTime(timeparts.shift());
    var endTime = extractTime(timeparts.shift());

    return (endTime > startTime) ? [startTime, endTime] : [startTime, false];
  },

  getStartTimeCode: function getStartTimecode(start) {
      return this.parse(start)[0];
  }
};

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/timecode.js","/")
},{"./util":24,"buffer":2,"oMfpAn":5}],22:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

/*
 [
 {type: "image", "title": "The very best Image", "url": "http://domain.com/images/test1.png"},
 {type: "shownote", "text": "PAPAPAPAPAPAGENO"},
 {type: "topic", start: 0, end: 1, q:true, title: "The very first chapter" },
 {type: "audio", start: 0, end: 1, q:true, class: 'speech'},
 {type: "audio", start: 1, end: 2, q:true, class: 'music'},
 {type: "audio", start: 2, end: 3, q:true, class: 'noise'},
 {type: "audio", start: 4, end: 5, q:true, class: 'silence'},
 {type: "content", start: 0, end: 1, q:true, title: "The very first chapter", class:'advertisement'},
 {type: "location", start: 0, end: 1, q:false, title: "Around Berlin", lat:12.123, lon:52.234, diameter:123 },
 {type: "chat", q:false, start: 0.12, "data": "ERSTER & HITLER!!!"},
 {type: "shownote", start: 0.23, "data": "Jemand vadert"},
 {type: "image", "name": "The very best Image", "url": "http://domain.com/images/test1.png"},
 {type: "link", "name": "An interesting link", "url": "http://"},
 {type: "topic", start: 1, end: 2, "name": "The very first chapter", "url": ""},
 ]
 */
var tc = require('./timecode')
  , cap = require('./util').cap;

function addType(type) {
  return function (element) {
    element.type = type;
    return element;
  };
}

function call(listener) {
  listener(this);
}

function filterByType(type) {
  return function (record) {
    return (record.type === type);
  };
}

/**
 *
 * @param {Timeline} timeline
 */
function logCurrentTime(timeline) {
  console.log('Timeline', 'currentTime', timeline.getTime());
}

/**
 *
 * @param {object} params
 * @returns {boolean} true if at least one chapter is present
 */
function checkForChapters(params) {
  return !!params.chapters && (
    typeof params.chapters === 'object' && params.chapters.length > 1
    );
}

function parse(data) {
  return data;
}

function stopOnEndTime() {
  if (this.currentTime >= this.endTime) {
    console.log('ENDTIME REACHED');
    this.player.stop();
    delete this.endTime;
  }
}

/**
 *
 * @param {HTMLMediaElement} player
 * @param {object} data
 * @constructor
 */
function Timeline(player, data) {
  this.player = player;
  this.hasChapters = checkForChapters(data);
  this.modules = [];
  this.listeners = [logCurrentTime];
  this.currentTime = -1;
  this.duration = data.duration;
  this.bufferedTime = 0;
  this.resume = player.paused;
  this.seeking = false;
}

Timeline.prototype.getData = function () {
  return this.data;
};

Timeline.prototype.getDataByType = function (type) {
  return this.data.filter(filterByType(type));
};

Timeline.prototype.addModule = function (module) {
  if (module.update) {
    this.listeners.push(module.update);
  }
  if (module.data) {
    this.data = module.data;
  }
  this.modules.push(module);
};

Timeline.prototype.playRange = function (range) {
  if (!range || !range.length || !range.shift) {
    throw new TypeError('Timeline.playRange called without a range');
  }
  this.setTime(range.shift());
  this.stopAt(range.shift());
};

Timeline.prototype.update = function (event) {
  console.log('Timeline', 'update', event);
  this.setBufferedTime(event);

  if (event && event.type === 'timeupdate') {
    this.currentTime = this.player.currentTime;
  }
  this.listeners.forEach(call, this);
};

Timeline.prototype.emitEventsBetween = function (start, end) {
  var emitStarted = false,
    emit = function (event) {
      var customEvent = new $.Event(event.type, event);
      $(this).trigger(customEvent);
    }.bind(this);
  this.data.map(function (event) {
    var later = (event.start > start),
      earlier = (event.end < start),
      ended = (event.end < end);

    if (later && earlier && !ended || emitStarted) {
      console.log('Timeline', 'Emit', event);
      emit(event);
    }
    emitStarted = later;
  });
};

/**
 * returns if time is a valid timestamp in current timeline
 * @param {*} time
 * @returns {boolean}
 */
Timeline.prototype.isValidTime = function (time) {
  return (typeof time === 'number' && !isNaN(time) && time >= 0 && time <= this.duration);
};

Timeline.prototype.setTime = function (time) {
  if (!this.isValidTime(time)) {
    console.warn('Timeline', 'setTime', 'time out of bounds', time);
    return this.currentTime;
  }

  console.log('Timeline', 'setTime', 'time', time);
  this.currentTime = time;
  this.update();

  // avoid event hellfire
  if (this.seeking) { return this.currentTime; }

  console.log('canplay', 'setTime', 'playerState', this.player.readyState);
  if (this.player.readyState === this.player.HAVE_ENOUGH_DATA) {
    this.player.setCurrentTime(time);
    return this.currentTime;
  }

  // TODO visualize buffer state
  // $(document).find('.play').css({color:'red'});
  $(this.player).one('canplay', function () {
    // TODO remove buffer state visual
    // $(document).find('.play').css({color:'white'});
    console.log('Player', 'canplay', 'buffered', time);
    this.setCurrentTime(time);
  });

  return this.currentTime;
};

Timeline.prototype.seek = function (time) {
  console.log('seek', 'seek', this.resume);
  this.seeking = true;
  this.currentTime = cap(time, 0, this.duration);
  this.setTime(this.currentTime);
};

Timeline.prototype.seekStart = function () {
  console.log('seek', 'start', this.resume);
  this.resume = !this.player.paused; // setting this to false makes Safari happy
  if (this.resume) {
    this.player.pause();
  }
};

Timeline.prototype.seekEnd = function () {
  console.log('seek', 'end', this.resume);
  this.seeking = false;
  this.setTime(this.currentTime); //force latest position in track
  if (this.resume) {
    console.log('seek', 'end', 'resume', this.currentTime);
    this.player.play();
  }
  this.resume = !this.player.paused; // seekstart may not be called
};

Timeline.prototype.stopAt = function (time) {
  if (!time || time <= 0 || time > this.duration) {
    return console.warn('Timeline', 'stopAt', 'time out of bounds', time);
  }
  var self = this;
  this.endTime = time;
  this.listeners.push(function () {
    stopOnEndTime.call(self);
  });
};

Timeline.prototype.getTime = function () {
  return this.currentTime;
};

Timeline.prototype.getBuffered = function () {
  if (isNaN(this.bufferedTime)) {
    console.warn('Timeline', 'getBuffered', 'bufferedTime is not a number');
    return 0;
  }
  return this.bufferedTime;
};

Timeline.prototype.setBufferedTime = function (e) {
  var target = (e !== undefined) ? e.target : this.player;
  var buffered = 0;

  // newest HTML5 spec has buffered array (FF4, Webkit)
  if (target && target.buffered && target.buffered.length > 0 && target.buffered.end && target.duration) {
    buffered = target.buffered.end(target.buffered.length - 1);
  }
  // Some browsers (e.g., FF3.6 and Safari 5) cannot calculate target.bufferered.end()
  // to be anything other than 0. If the byte count is available we use this instead.
  // Browsers that support the else if do not seem to have the bufferedBytes value and
  // should skip to there. Tested in Safari 5, Webkit head, FF3.6, Chrome 6, IE 7/8.
  else if (target && target.bytesTotal !== undefined && target.bytesTotal > 0 && target.bufferedBytes !== undefined) {
    buffered = target.bufferedBytes / target.bytesTotal * target.duration;
  }
  // Firefox 3 with an Ogg file seems to go this way
  else if (e && e.lengthComputable && e.total !== 0) {
    buffered = e.loaded / e.total * target.duration;
  }
  var cappedTime = cap(buffered, 0, target.duration);
  console.log('Timeline', 'setBufferedTime', cappedTime);
  this.bufferedTime = cappedTime;
};

Timeline.prototype.rewind = function () {
  this.setTime(0);
  var callListenerWithThis = function _callListenerWithThis(i, listener) {
    listener(this);
  }.bind(this);
  $.each(this.listeners, callListenerWithThis);
};

module.exports = Timeline;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/timeline.js","/")
},{"./timecode":21,"./util":24,"buffer":2,"oMfpAn":5}],23:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var tc = require('./timecode');

/*
  "t=1"	[("t", "1")]	simple case
  "t=1&t=2"	[("t", "1"), ("t", "2")]	repeated name
  "a=b=c"	[("a", "b=c")]	"=" in value
  "a&b=c"	[("a", ""), ("b", "c")]	missing value
  "%74=%6ept%3A%310"	[("t", "npt:10")]	unnecssary percent-encoding
  "id=%xy&t=1"	[("t", "1")]	invalid percent-encoding
  "id=%E4r&t=1"	[("t", "1")]	invalid UTF-8
 */

/**
 * get the value of a specific URL hash fragment
 * @param {string} key name of the fragment
 * @returns {string|boolean} value of the fragment or false when not found in URL
 */
function getFragment(key) {
  var query = window.location.hash.substring(1),
    pairs = query.split('&');

  if (query.indexOf(key) === -1) {
    return false;
  }

  for (var i = 0, l = pairs.length; i < l; i++) {
    var pair = pairs[i].split('=');
    if (pair[0] !== key) {
      continue;
    }
    if (pair.length === 1) {
      return true;
    }
    return decodeURIComponent(pair[1]);
  }
  return false;
}

/**
 * URL handling helpers
 */
module.exports = {
  getFragment: getFragment,
  checkCurrent: function () {
    var t = getFragment('t');
    return tc.parse(t);
  }
};

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/url.js","/")
},{"./timecode":21,"buffer":2,"oMfpAn":5}],24:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

/**
 * return new value in bounds of min and max
 * @param {number} val any number
 * @param {number} min lower boundary for val
 * @param {number} max upper boundary for val
 * @returns {number} resulting value
 */
function cap(val, min, max) {
  // cap x values
  val = Math.max(val, min);
  val = Math.min(val, max);
  return val;
}

/**
 * return number as string lefthand filled with zeros
 * @param {number} number (integer) value to be padded
 * @param {number} width length of the string that is returned
 * @returns {string} padded number
 */
function zeroFill (number, width) {
  var s = number.toString();
  while (s.length < width) {
    s = '0' + s;
  }
  return s;
}

module.exports = {
  cap: cap,
  zeroFill: zeroFill
};

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/util.js","/")
},{"buffer":2,"oMfpAn":5}]},{},[8])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9LYWkvZ2l0L3BvZGxvdmUtd2ViLXBsYXllci9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvS2FpL2dpdC9wb2Rsb3ZlLXdlYi1wbGF5ZXIvYm93ZXJfY29tcG9uZW50cy9tZWRpYWVsZW1lbnQvYnVpbGQvbWVkaWFlbGVtZW50LmpzIiwiL1VzZXJzL0thaS9naXQvcG9kbG92ZS13ZWItcGxheWVyL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qcyIsIi9Vc2Vycy9LYWkvZ2l0L3BvZGxvdmUtd2ViLXBsYXllci9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2Jhc2U2NC1qcy9saWIvYjY0LmpzIiwiL1VzZXJzL0thaS9naXQvcG9kbG92ZS13ZWItcGxheWVyL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvaWVlZTc1NC9pbmRleC5qcyIsIi9Vc2Vycy9LYWkvZ2l0L3BvZGxvdmUtd2ViLXBsYXllci9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCIvVXNlcnMvS2FpL2dpdC9wb2Rsb3ZlLXdlYi1wbGF5ZXIvc3JjL2pzL2NvbnRyb2xzLmpzIiwiL1VzZXJzL0thaS9naXQvcG9kbG92ZS13ZWItcGxheWVyL3NyYy9qcy9lbWJlZC5qcyIsIi9Vc2Vycy9LYWkvZ2l0L3BvZGxvdmUtd2ViLXBsYXllci9zcmMvanMvZmFrZV83OTlhNDBkMS5qcyIsIi9Vc2Vycy9LYWkvZ2l0L3BvZGxvdmUtd2ViLXBsYXllci9zcmMvanMvbW9kdWxlcy9jaGFwdGVyLmpzIiwiL1VzZXJzL0thaS9naXQvcG9kbG92ZS13ZWItcGxheWVyL3NyYy9qcy9tb2R1bGVzL2Rvd25sb2Fkcy5qcyIsIi9Vc2Vycy9LYWkvZ2l0L3BvZGxvdmUtd2ViLXBsYXllci9zcmMvanMvbW9kdWxlcy9pbmZvLmpzIiwiL1VzZXJzL0thaS9naXQvcG9kbG92ZS13ZWItcGxheWVyL3NyYy9qcy9tb2R1bGVzL3Byb2dyZXNzYmFyLmpzIiwiL1VzZXJzL0thaS9naXQvcG9kbG92ZS13ZWItcGxheWVyL3NyYy9qcy9tb2R1bGVzL3NhdmV0aW1lLmpzIiwiL1VzZXJzL0thaS9naXQvcG9kbG92ZS13ZWItcGxheWVyL3NyYy9qcy9tb2R1bGVzL3NoYXJlLmpzIiwiL1VzZXJzL0thaS9naXQvcG9kbG92ZS13ZWItcGxheWVyL3NyYy9qcy9wbGF5ZXIuanMiLCIvVXNlcnMvS2FpL2dpdC9wb2Rsb3ZlLXdlYi1wbGF5ZXIvc3JjL2pzL3NvY2lhbC1idXR0b24tbGlzdC5qcyIsIi9Vc2Vycy9LYWkvZ2l0L3BvZGxvdmUtd2ViLXBsYXllci9zcmMvanMvc29jaWFsLW5ldHdvcmsuanMiLCIvVXNlcnMvS2FpL2dpdC9wb2Rsb3ZlLXdlYi1wbGF5ZXIvc3JjL2pzL3NvY2lhbC1uZXR3b3Jrcy5qcyIsIi9Vc2Vycy9LYWkvZ2l0L3BvZGxvdmUtd2ViLXBsYXllci9zcmMvanMvdGFiLmpzIiwiL1VzZXJzL0thaS9naXQvcG9kbG92ZS13ZWItcGxheWVyL3NyYy9qcy90YWJyZWdpc3RyeS5qcyIsIi9Vc2Vycy9LYWkvZ2l0L3BvZGxvdmUtd2ViLXBsYXllci9zcmMvanMvdGltZWNvZGUuanMiLCIvVXNlcnMvS2FpL2dpdC9wb2Rsb3ZlLXdlYi1wbGF5ZXIvc3JjL2pzL3RpbWVsaW5lLmpzIiwiL1VzZXJzL0thaS9naXQvcG9kbG92ZS13ZWItcGxheWVyL3NyYy9qcy91cmwuanMiLCIvVXNlcnMvS2FpL2dpdC9wb2Rsb3ZlLXdlYi1wbGF5ZXIvc3JjL2pzL3V0aWwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3M0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdmxDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvYUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1UUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuLyohXG4gKlxuICogTWVkaWFFbGVtZW50LmpzXG4gKiBIVE1MNSA8dmlkZW8+IGFuZCA8YXVkaW8+IHNoaW0gYW5kIHBsYXllclxuICogaHR0cDovL21lZGlhZWxlbWVudGpzLmNvbS9cbiAqXG4gKiBDcmVhdGVzIGEgSmF2YVNjcmlwdCBvYmplY3QgdGhhdCBtaW1pY3MgSFRNTDUgTWVkaWFFbGVtZW50IEFQSVxuICogZm9yIGJyb3dzZXJzIHRoYXQgZG9uJ3QgdW5kZXJzdGFuZCBIVE1MNSBvciBjYW4ndCBwbGF5IHRoZSBwcm92aWRlZCBjb2RlY1xuICogQ2FuIHBsYXkgTVA0IChILjI2NCksIE9nZywgV2ViTSwgRkxWLCBXTVYsIFdNQSwgQUNDLCBhbmQgTVAzXG4gKlxuICogQ29weXJpZ2h0IDIwMTAtMjAxNCwgSm9obiBEeWVyIChodHRwOi8vai5obilcbiAqIExpY2Vuc2U6IE1JVFxuICpcbiAqL1xuLy8gTmFtZXNwYWNlXG52YXIgbWVqcyA9IG1lanMgfHwge307XG5cbi8vIHZlcnNpb24gbnVtYmVyXG5tZWpzLnZlcnNpb24gPSAnMi4xNi40JzsgXG5cblxuLy8gcGxheWVyIG51bWJlciAoZm9yIG1pc3NpbmcsIHNhbWUgaWQgYXR0cilcbm1lanMubWVJbmRleCA9IDA7XG5cbi8vIG1lZGlhIHR5cGVzIGFjY2VwdGVkIGJ5IHBsdWdpbnNcbm1lanMucGx1Z2lucyA9IHtcblx0c2lsdmVybGlnaHQ6IFtcblx0XHR7dmVyc2lvbjogWzMsMF0sIHR5cGVzOiBbJ3ZpZGVvL21wNCcsJ3ZpZGVvL200dicsJ3ZpZGVvL21vdicsJ3ZpZGVvL3dtdicsJ2F1ZGlvL3dtYScsJ2F1ZGlvL200YScsJ2F1ZGlvL21wMycsJ2F1ZGlvL3dhdicsJ2F1ZGlvL21wZWcnXX1cblx0XSxcblx0Zmxhc2g6IFtcblx0XHR7dmVyc2lvbjogWzksMCwxMjRdLCB0eXBlczogWyd2aWRlby9tcDQnLCd2aWRlby9tNHYnLCd2aWRlby9tb3YnLCd2aWRlby9mbHYnLCd2aWRlby9ydG1wJywndmlkZW8veC1mbHYnLCdhdWRpby9mbHYnLCdhdWRpby94LWZsdicsJ2F1ZGlvL21wMycsJ2F1ZGlvL200YScsJ2F1ZGlvL21wZWcnLCAndmlkZW8veW91dHViZScsICd2aWRlby94LXlvdXR1YmUnLCAnYXBwbGljYXRpb24veC1tcGVnVVJMJ119XG5cdFx0Ly8se3ZlcnNpb246IFsxMiwwXSwgdHlwZXM6IFsndmlkZW8vd2VibSddfSAvLyBmb3IgZnV0dXJlIHJlZmVyZW5jZSAoaG9wZWZ1bGx5ISlcblx0XSxcblx0eW91dHViZTogW1xuXHRcdHt2ZXJzaW9uOiBudWxsLCB0eXBlczogWyd2aWRlby95b3V0dWJlJywgJ3ZpZGVvL3gteW91dHViZScsICdhdWRpby95b3V0dWJlJywgJ2F1ZGlvL3gteW91dHViZSddfVxuXHRdLFxuXHR2aW1lbzogW1xuXHRcdHt2ZXJzaW9uOiBudWxsLCB0eXBlczogWyd2aWRlby92aW1lbycsICd2aWRlby94LXZpbWVvJ119XG5cdF1cbn07XG5cbi8qXG5VdGlsaXR5IG1ldGhvZHNcbiovXG5tZWpzLlV0aWxpdHkgPSB7XG5cdGVuY29kZVVybDogZnVuY3Rpb24odXJsKSB7XG5cdFx0cmV0dXJuIGVuY29kZVVSSUNvbXBvbmVudCh1cmwpOyAvLy5yZXBsYWNlKC9cXD8vZ2ksJyUzRicpLnJlcGxhY2UoLz0vZ2ksJyUzRCcpLnJlcGxhY2UoLyYvZ2ksJyUyNicpO1xuXHR9LFxuXHRlc2NhcGVIVE1MOiBmdW5jdGlvbihzKSB7XG5cdFx0cmV0dXJuIHMudG9TdHJpbmcoKS5zcGxpdCgnJicpLmpvaW4oJyZhbXA7Jykuc3BsaXQoJzwnKS5qb2luKCcmbHQ7Jykuc3BsaXQoJ1wiJykuam9pbignJnF1b3Q7Jyk7XG5cdH0sXG5cdGFic29sdXRpemVVcmw6IGZ1bmN0aW9uKHVybCkge1xuXHRcdHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGVsLmlubmVySFRNTCA9ICc8YSBocmVmPVwiJyArIHRoaXMuZXNjYXBlSFRNTCh1cmwpICsgJ1wiPng8L2E+Jztcblx0XHRyZXR1cm4gZWwuZmlyc3RDaGlsZC5ocmVmO1xuXHR9LFxuXHRnZXRTY3JpcHRQYXRoOiBmdW5jdGlvbihzY3JpcHROYW1lcykge1xuXHRcdHZhclxuXHRcdFx0aSA9IDAsXG5cdFx0XHRqLFxuXHRcdFx0Y29kZVBhdGggPSAnJyxcblx0XHRcdHRlc3RuYW1lID0gJycsXG5cdFx0XHRzbGFzaFBvcyxcblx0XHRcdGZpbGVuYW1lUG9zLFxuXHRcdFx0c2NyaXB0VXJsLFxuXHRcdFx0c2NyaXB0UGF0aCxcdFx0XHRcblx0XHRcdHNjcmlwdEZpbGVuYW1lLFxuXHRcdFx0c2NyaXB0cyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdzY3JpcHQnKSxcblx0XHRcdGlsID0gc2NyaXB0cy5sZW5ndGgsXG5cdFx0XHRqbCA9IHNjcmlwdE5hbWVzLmxlbmd0aDtcblx0XHRcdFxuXHRcdC8vIGdvIHRocm91Z2ggYWxsIDxzY3JpcHQ+IHRhZ3Ncblx0XHRmb3IgKDsgaSA8IGlsOyBpKyspIHtcblx0XHRcdHNjcmlwdFVybCA9IHNjcmlwdHNbaV0uc3JjO1xuXHRcdFx0c2xhc2hQb3MgPSBzY3JpcHRVcmwubGFzdEluZGV4T2YoJy8nKTtcblx0XHRcdGlmIChzbGFzaFBvcyA+IC0xKSB7XG5cdFx0XHRcdHNjcmlwdEZpbGVuYW1lID0gc2NyaXB0VXJsLnN1YnN0cmluZyhzbGFzaFBvcyArIDEpO1xuXHRcdFx0XHRzY3JpcHRQYXRoID0gc2NyaXB0VXJsLnN1YnN0cmluZygwLCBzbGFzaFBvcyArIDEpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c2NyaXB0RmlsZW5hbWUgPSBzY3JpcHRVcmw7XG5cdFx0XHRcdHNjcmlwdFBhdGggPSAnJztcdFx0XHRcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly8gc2VlIGlmIGFueSA8c2NyaXB0PiB0YWdzIGhhdmUgYSBmaWxlIG5hbWUgdGhhdCBtYXRjaGVzIHRoZSBcblx0XHRcdGZvciAoaiA9IDA7IGogPCBqbDsgaisrKSB7XG5cdFx0XHRcdHRlc3RuYW1lID0gc2NyaXB0TmFtZXNbal07XG5cdFx0XHRcdGZpbGVuYW1lUG9zID0gc2NyaXB0RmlsZW5hbWUuaW5kZXhPZih0ZXN0bmFtZSk7XG5cdFx0XHRcdGlmIChmaWxlbmFtZVBvcyA+IC0xKSB7XG5cdFx0XHRcdFx0Y29kZVBhdGggPSBzY3JpcHRQYXRoO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vIGlmIHdlIGZvdW5kIGEgcGF0aCwgdGhlbiBicmVhayBhbmQgcmV0dXJuIGl0XG5cdFx0XHRpZiAoY29kZVBhdGggIT09ICcnKSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRcblx0XHQvLyBzZW5kIHRoZSBiZXN0IHBhdGggYmFja1xuXHRcdHJldHVybiBjb2RlUGF0aDtcblx0fSxcblx0c2Vjb25kc1RvVGltZUNvZGU6IGZ1bmN0aW9uKHRpbWUsIGZvcmNlSG91cnMsIHNob3dGcmFtZUNvdW50LCBmcHMpIHtcblx0XHQvL2FkZCBmcmFtZWNvdW50XG5cdFx0aWYgKHR5cGVvZiBzaG93RnJhbWVDb3VudCA9PSAndW5kZWZpbmVkJykge1xuXHRcdCAgICBzaG93RnJhbWVDb3VudD1mYWxzZTtcblx0XHR9IGVsc2UgaWYodHlwZW9mIGZwcyA9PSAndW5kZWZpbmVkJykge1xuXHRcdCAgICBmcHMgPSAyNTtcblx0XHR9XG5cdFxuXHRcdHZhciBob3VycyA9IE1hdGguZmxvb3IodGltZSAvIDM2MDApICUgMjQsXG5cdFx0XHRtaW51dGVzID0gTWF0aC5mbG9vcih0aW1lIC8gNjApICUgNjAsXG5cdFx0XHRzZWNvbmRzID0gTWF0aC5mbG9vcih0aW1lICUgNjApLFxuXHRcdFx0ZnJhbWVzID0gTWF0aC5mbG9vcigoKHRpbWUgJSAxKSpmcHMpLnRvRml4ZWQoMykpLFxuXHRcdFx0cmVzdWx0ID0gXG5cdFx0XHRcdFx0KCAoZm9yY2VIb3VycyB8fCBob3VycyA+IDApID8gKGhvdXJzIDwgMTAgPyAnMCcgKyBob3VycyA6IGhvdXJzKSArICc6JyA6ICcnKVxuXHRcdFx0XHRcdFx0KyAobWludXRlcyA8IDEwID8gJzAnICsgbWludXRlcyA6IG1pbnV0ZXMpICsgJzonXG5cdFx0XHRcdFx0XHQrIChzZWNvbmRzIDwgMTAgPyAnMCcgKyBzZWNvbmRzIDogc2Vjb25kcylcblx0XHRcdFx0XHRcdCsgKChzaG93RnJhbWVDb3VudCkgPyAnOicgKyAoZnJhbWVzIDwgMTAgPyAnMCcgKyBmcmFtZXMgOiBmcmFtZXMpIDogJycpO1xuXHRcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9LFxuXHRcblx0dGltZUNvZGVUb1NlY29uZHM6IGZ1bmN0aW9uKGhoX21tX3NzX2ZmLCBmb3JjZUhvdXJzLCBzaG93RnJhbWVDb3VudCwgZnBzKXtcblx0XHRpZiAodHlwZW9mIHNob3dGcmFtZUNvdW50ID09ICd1bmRlZmluZWQnKSB7XG5cdFx0ICAgIHNob3dGcmFtZUNvdW50PWZhbHNlO1xuXHRcdH0gZWxzZSBpZih0eXBlb2YgZnBzID09ICd1bmRlZmluZWQnKSB7XG5cdFx0ICAgIGZwcyA9IDI1O1xuXHRcdH1cblx0XG5cdFx0dmFyIHRjX2FycmF5ID0gaGhfbW1fc3NfZmYuc3BsaXQoXCI6XCIpLFxuXHRcdFx0dGNfaGggPSBwYXJzZUludCh0Y19hcnJheVswXSwgMTApLFxuXHRcdFx0dGNfbW0gPSBwYXJzZUludCh0Y19hcnJheVsxXSwgMTApLFxuXHRcdFx0dGNfc3MgPSBwYXJzZUludCh0Y19hcnJheVsyXSwgMTApLFxuXHRcdFx0dGNfZmYgPSAwLFxuXHRcdFx0dGNfaW5fc2Vjb25kcyA9IDA7XG5cdFx0XG5cdFx0aWYgKHNob3dGcmFtZUNvdW50KSB7XG5cdFx0ICAgIHRjX2ZmID0gcGFyc2VJbnQodGNfYXJyYXlbM10pL2Zwcztcblx0XHR9XG5cdFx0XG5cdFx0dGNfaW5fc2Vjb25kcyA9ICggdGNfaGggKiAzNjAwICkgKyAoIHRjX21tICogNjAgKSArIHRjX3NzICsgdGNfZmY7XG5cdFx0XG5cdFx0cmV0dXJuIHRjX2luX3NlY29uZHM7XG5cdH0sXG5cdFxuXG5cdGNvbnZlcnRTTVBURXRvU2Vjb25kczogZnVuY3Rpb24gKFNNUFRFKSB7XG5cdFx0aWYgKHR5cGVvZiBTTVBURSAhPSAnc3RyaW5nJykgXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cblx0XHRTTVBURSA9IFNNUFRFLnJlcGxhY2UoJywnLCAnLicpO1xuXHRcdFxuXHRcdHZhciBzZWNzID0gMCxcblx0XHRcdGRlY2ltYWxMZW4gPSAoU01QVEUuaW5kZXhPZignLicpICE9IC0xKSA/IFNNUFRFLnNwbGl0KCcuJylbMV0ubGVuZ3RoIDogMCxcblx0XHRcdG11bHRpcGxpZXIgPSAxO1xuXHRcdFxuXHRcdFNNUFRFID0gU01QVEUuc3BsaXQoJzonKS5yZXZlcnNlKCk7XG5cdFx0XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBTTVBURS5sZW5ndGg7IGkrKykge1xuXHRcdFx0bXVsdGlwbGllciA9IDE7XG5cdFx0XHRpZiAoaSA+IDApIHtcblx0XHRcdFx0bXVsdGlwbGllciA9IE1hdGgucG93KDYwLCBpKTsgXG5cdFx0XHR9XG5cdFx0XHRzZWNzICs9IE51bWJlcihTTVBURVtpXSkgKiBtdWx0aXBsaWVyO1xuXHRcdH1cblx0XHRyZXR1cm4gTnVtYmVyKHNlY3MudG9GaXhlZChkZWNpbWFsTGVuKSk7XG5cdH0sXHRcblx0XG5cdC8qIGJvcnJvd2VkIGZyb20gU1dGT2JqZWN0OiBodHRwOi8vY29kZS5nb29nbGUuY29tL3Avc3dmb2JqZWN0L3NvdXJjZS9icm93c2UvdHJ1bmsvc3dmb2JqZWN0L3NyYy9zd2ZvYmplY3QuanMjNDc0ICovXG5cdHJlbW92ZVN3ZjogZnVuY3Rpb24oaWQpIHtcblx0XHR2YXIgb2JqID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpO1xuXHRcdGlmIChvYmogJiYgL29iamVjdHxlbWJlZC9pLnRlc3Qob2JqLm5vZGVOYW1lKSkge1xuXHRcdFx0aWYgKG1lanMuTWVkaWFGZWF0dXJlcy5pc0lFKSB7XG5cdFx0XHRcdG9iai5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdFx0XHRcdChmdW5jdGlvbigpe1xuXHRcdFx0XHRcdGlmIChvYmoucmVhZHlTdGF0ZSA9PSA0KSB7XG5cdFx0XHRcdFx0XHRtZWpzLlV0aWxpdHkucmVtb3ZlT2JqZWN0SW5JRShpZCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMTApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG9iai5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG9iaik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuXHRyZW1vdmVPYmplY3RJbklFOiBmdW5jdGlvbihpZCkge1xuXHRcdHZhciBvYmogPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChpZCk7XG5cdFx0aWYgKG9iaikge1xuXHRcdFx0Zm9yICh2YXIgaSBpbiBvYmopIHtcblx0XHRcdFx0aWYgKHR5cGVvZiBvYmpbaV0gPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRcdFx0b2JqW2ldID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0b2JqLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQob2JqKTtcblx0XHR9XHRcdFxuXHR9XG59O1xuXG5cbi8vIENvcmUgZGV0ZWN0b3IsIHBsdWdpbnMgYXJlIGFkZGVkIGJlbG93XG5tZWpzLlBsdWdpbkRldGVjdG9yID0ge1xuXG5cdC8vIG1haW4gcHVibGljIGZ1bmN0aW9uIHRvIHRlc3QgYSBwbHVnIHZlcnNpb24gbnVtYmVyIFBsdWdpbkRldGVjdG9yLmhhc1BsdWdpblZlcnNpb24oJ2ZsYXNoJyxbOSwwLDEyNV0pO1xuXHRoYXNQbHVnaW5WZXJzaW9uOiBmdW5jdGlvbihwbHVnaW4sIHYpIHtcblx0XHR2YXIgcHYgPSB0aGlzLnBsdWdpbnNbcGx1Z2luXTtcblx0XHR2WzFdID0gdlsxXSB8fCAwO1xuXHRcdHZbMl0gPSB2WzJdIHx8IDA7XG5cdFx0cmV0dXJuIChwdlswXSA+IHZbMF0gfHwgKHB2WzBdID09IHZbMF0gJiYgcHZbMV0gPiB2WzFdKSB8fCAocHZbMF0gPT0gdlswXSAmJiBwdlsxXSA9PSB2WzFdICYmIHB2WzJdID49IHZbMl0pKSA/IHRydWUgOiBmYWxzZTtcblx0fSxcblxuXHQvLyBjYWNoZWQgdmFsdWVzXG5cdG5hdjogd2luZG93Lm5hdmlnYXRvcixcblx0dWE6IHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCksXG5cblx0Ly8gc3RvcmVkIHZlcnNpb24gbnVtYmVyc1xuXHRwbHVnaW5zOiBbXSxcblxuXHQvLyBydW5zIGRldGVjdFBsdWdpbigpIGFuZCBzdG9yZXMgdGhlIHZlcnNpb24gbnVtYmVyXG5cdGFkZFBsdWdpbjogZnVuY3Rpb24ocCwgcGx1Z2luTmFtZSwgbWltZVR5cGUsIGFjdGl2ZVgsIGF4RGV0ZWN0KSB7XG5cdFx0dGhpcy5wbHVnaW5zW3BdID0gdGhpcy5kZXRlY3RQbHVnaW4ocGx1Z2luTmFtZSwgbWltZVR5cGUsIGFjdGl2ZVgsIGF4RGV0ZWN0KTtcblx0fSxcblxuXHQvLyBnZXQgdGhlIHZlcnNpb24gbnVtYmVyIGZyb20gdGhlIG1pbWV0eXBlIChhbGwgYnV0IElFKSBvciBBY3RpdmVYIChJRSlcblx0ZGV0ZWN0UGx1Z2luOiBmdW5jdGlvbihwbHVnaW5OYW1lLCBtaW1lVHlwZSwgYWN0aXZlWCwgYXhEZXRlY3QpIHtcblxuXHRcdHZhciB2ZXJzaW9uID0gWzAsMCwwXSxcblx0XHRcdGRlc2NyaXB0aW9uLFxuXHRcdFx0aSxcblx0XHRcdGF4O1xuXG5cdFx0Ly8gRmlyZWZveCwgV2Via2l0LCBPcGVyYVxuXHRcdGlmICh0eXBlb2YodGhpcy5uYXYucGx1Z2lucykgIT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIHRoaXMubmF2LnBsdWdpbnNbcGx1Z2luTmFtZV0gPT0gJ29iamVjdCcpIHtcblx0XHRcdGRlc2NyaXB0aW9uID0gdGhpcy5uYXYucGx1Z2luc1twbHVnaW5OYW1lXS5kZXNjcmlwdGlvbjtcblx0XHRcdGlmIChkZXNjcmlwdGlvbiAmJiAhKHR5cGVvZiB0aGlzLm5hdi5taW1lVHlwZXMgIT0gJ3VuZGVmaW5lZCcgJiYgdGhpcy5uYXYubWltZVR5cGVzW21pbWVUeXBlXSAmJiAhdGhpcy5uYXYubWltZVR5cGVzW21pbWVUeXBlXS5lbmFibGVkUGx1Z2luKSkge1xuXHRcdFx0XHR2ZXJzaW9uID0gZGVzY3JpcHRpb24ucmVwbGFjZShwbHVnaW5OYW1lLCAnJykucmVwbGFjZSgvXlxccysvLCcnKS5yZXBsYWNlKC9cXHNyL2dpLCcuJykuc3BsaXQoJy4nKTtcblx0XHRcdFx0Zm9yIChpPTA7IGk8dmVyc2lvbi5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdHZlcnNpb25baV0gPSBwYXJzZUludCh2ZXJzaW9uW2ldLm1hdGNoKC9cXGQrLyksIDEwKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdC8vIEludGVybmV0IEV4cGxvcmVyIC8gQWN0aXZlWFxuXHRcdH0gZWxzZSBpZiAodHlwZW9mKHdpbmRvdy5BY3RpdmVYT2JqZWN0KSAhPSAndW5kZWZpbmVkJykge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXggPSBuZXcgQWN0aXZlWE9iamVjdChhY3RpdmVYKTtcblx0XHRcdFx0aWYgKGF4KSB7XG5cdFx0XHRcdFx0dmVyc2lvbiA9IGF4RGV0ZWN0KGF4KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y2F0Y2ggKGUpIHsgfVxuXHRcdH1cblx0XHRyZXR1cm4gdmVyc2lvbjtcblx0fVxufTtcblxuLy8gQWRkIEZsYXNoIGRldGVjdGlvblxubWVqcy5QbHVnaW5EZXRlY3Rvci5hZGRQbHVnaW4oJ2ZsYXNoJywnU2hvY2t3YXZlIEZsYXNoJywnYXBwbGljYXRpb24veC1zaG9ja3dhdmUtZmxhc2gnLCdTaG9ja3dhdmVGbGFzaC5TaG9ja3dhdmVGbGFzaCcsIGZ1bmN0aW9uKGF4KSB7XG5cdC8vIGFkYXB0ZWQgZnJvbSBTV0ZPYmplY3Rcblx0dmFyIHZlcnNpb24gPSBbXSxcblx0XHRkID0gYXguR2V0VmFyaWFibGUoXCIkdmVyc2lvblwiKTtcblx0aWYgKGQpIHtcblx0XHRkID0gZC5zcGxpdChcIiBcIilbMV0uc3BsaXQoXCIsXCIpO1xuXHRcdHZlcnNpb24gPSBbcGFyc2VJbnQoZFswXSwgMTApLCBwYXJzZUludChkWzFdLCAxMCksIHBhcnNlSW50KGRbMl0sIDEwKV07XG5cdH1cblx0cmV0dXJuIHZlcnNpb247XG59KTtcblxuLy8gQWRkIFNpbHZlcmxpZ2h0IGRldGVjdGlvblxubWVqcy5QbHVnaW5EZXRlY3Rvci5hZGRQbHVnaW4oJ3NpbHZlcmxpZ2h0JywnU2lsdmVybGlnaHQgUGx1Zy1JbicsJ2FwcGxpY2F0aW9uL3gtc2lsdmVybGlnaHQtMicsJ0FnQ29udHJvbC5BZ0NvbnRyb2wnLCBmdW5jdGlvbiAoYXgpIHtcblx0Ly8gU2lsdmVybGlnaHQgY2Fubm90IHJlcG9ydCBpdHMgdmVyc2lvbiBudW1iZXIgdG8gSUVcblx0Ly8gYnV0IGl0IGRvZXMgaGF2ZSBhIGlzVmVyc2lvblN1cHBvcnRlZCBmdW5jdGlvbiwgc28gd2UgaGF2ZSB0byBsb29wIHRocm91Z2ggaXQgdG8gZ2V0IGEgdmVyc2lvbiBudW1iZXIuXG5cdC8vIGFkYXB0ZWQgZnJvbSBodHRwOi8vd3d3LnNpbHZlcmxpZ2h0dmVyc2lvbi5jb20vXG5cdHZhciB2ID0gWzAsMCwwLDBdLFxuXHRcdGxvb3BNYXRjaCA9IGZ1bmN0aW9uKGF4LCB2LCBpLCBuKSB7XG5cdFx0XHR3aGlsZShheC5pc1ZlcnNpb25TdXBwb3J0ZWQodlswXSsgXCIuXCIrIHZbMV0gKyBcIi5cIiArIHZbMl0gKyBcIi5cIiArIHZbM10pKXtcblx0XHRcdFx0dltpXSs9bjtcblx0XHRcdH1cblx0XHRcdHZbaV0gLT0gbjtcblx0XHR9O1xuXHRsb29wTWF0Y2goYXgsIHYsIDAsIDEpO1xuXHRsb29wTWF0Y2goYXgsIHYsIDEsIDEpO1xuXHRsb29wTWF0Y2goYXgsIHYsIDIsIDEwMDAwKTsgLy8gdGhlIHRoaXJkIHBsYWNlIGluIHRoZSB2ZXJzaW9uIG51bWJlciBpcyB1c3VhbGx5IDUgZGlnaXRzICg0LjAueHh4eHgpXG5cdGxvb3BNYXRjaChheCwgdiwgMiwgMTAwMCk7XG5cdGxvb3BNYXRjaChheCwgdiwgMiwgMTAwKTtcblx0bG9vcE1hdGNoKGF4LCB2LCAyLCAxMCk7XG5cdGxvb3BNYXRjaChheCwgdiwgMiwgMSk7XG5cdGxvb3BNYXRjaChheCwgdiwgMywgMSk7XG5cblx0cmV0dXJuIHY7XG59KTtcbi8vIGFkZCBhZG9iZSBhY3JvYmF0XG4vKlxuUGx1Z2luRGV0ZWN0b3IuYWRkUGx1Z2luKCdhY3JvYmF0JywnQWRvYmUgQWNyb2JhdCcsJ2FwcGxpY2F0aW9uL3BkZicsJ0Fjcm9QREYuUERGJywgZnVuY3Rpb24gKGF4KSB7XG5cdHZhciB2ZXJzaW9uID0gW10sXG5cdFx0ZCA9IGF4LkdldFZlcnNpb25zKCkuc3BsaXQoJywnKVswXS5zcGxpdCgnPScpWzFdLnNwbGl0KCcuJyk7XG5cblx0aWYgKGQpIHtcblx0XHR2ZXJzaW9uID0gW3BhcnNlSW50KGRbMF0sIDEwKSwgcGFyc2VJbnQoZFsxXSwgMTApLCBwYXJzZUludChkWzJdLCAxMCldO1xuXHR9XG5cdHJldHVybiB2ZXJzaW9uO1xufSk7XG4qL1xuLy8gbmVjZXNzYXJ5IGRldGVjdGlvbiAoZml4ZXMgZm9yIDxJRTkpXG5tZWpzLk1lZGlhRmVhdHVyZXMgPSB7XG5cdGluaXQ6IGZ1bmN0aW9uKCkge1xuXHRcdHZhclxuXHRcdFx0dCA9IHRoaXMsXG5cdFx0XHRkID0gZG9jdW1lbnQsXG5cdFx0XHRuYXYgPSBtZWpzLlBsdWdpbkRldGVjdG9yLm5hdixcblx0XHRcdHVhID0gbWVqcy5QbHVnaW5EZXRlY3Rvci51YS50b0xvd2VyQ2FzZSgpLFxuXHRcdFx0aSxcblx0XHRcdHYsXG5cdFx0XHRodG1sNUVsZW1lbnRzID0gWydzb3VyY2UnLCd0cmFjaycsJ2F1ZGlvJywndmlkZW8nXTtcblxuXHRcdC8vIGRldGVjdCBicm93c2VycyAob25seSB0aGUgb25lcyB0aGF0IGhhdmUgc29tZSBraW5kIG9mIHF1aXJrIHdlIG5lZWQgdG8gd29yayBhcm91bmQpXG5cdFx0dC5pc2lQYWQgPSAodWEubWF0Y2goL2lwYWQvaSkgIT09IG51bGwpO1xuXHRcdHQuaXNpUGhvbmUgPSAodWEubWF0Y2goL2lwaG9uZS9pKSAhPT0gbnVsbCk7XG5cdFx0dC5pc2lPUyA9IHQuaXNpUGhvbmUgfHwgdC5pc2lQYWQ7XG5cdFx0dC5pc0FuZHJvaWQgPSAodWEubWF0Y2goL2FuZHJvaWQvaSkgIT09IG51bGwpO1xuXHRcdHQuaXNCdXN0ZWRBbmRyb2lkID0gKHVhLm1hdGNoKC9hbmRyb2lkIDJcXC5bMTJdLykgIT09IG51bGwpO1xuXHRcdHQuaXNCdXN0ZWROYXRpdmVIVFRQUyA9IChsb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2h0dHBzOicgJiYgKHVhLm1hdGNoKC9hbmRyb2lkIFsxMl1cXC4vKSAhPT0gbnVsbCB8fCB1YS5tYXRjaCgvbWFjaW50b3NoLiogdmVyc2lvbi4qIHNhZmFyaS8pICE9PSBudWxsKSk7XG5cdFx0dC5pc0lFID0gKG5hdi5hcHBOYW1lLnRvTG93ZXJDYXNlKCkuaW5kZXhPZihcIm1pY3Jvc29mdFwiKSAhPSAtMSB8fCBuYXYuYXBwTmFtZS50b0xvd2VyQ2FzZSgpLm1hdGNoKC90cmlkZW50L2dpKSAhPT0gbnVsbCk7XG5cdFx0dC5pc0Nocm9tZSA9ICh1YS5tYXRjaCgvY2hyb21lL2dpKSAhPT0gbnVsbCk7XG5cdFx0dC5pc0Nocm9taXVtID0gKHVhLm1hdGNoKC9jaHJvbWl1bS9naSkgIT09IG51bGwpO1xuXHRcdHQuaXNGaXJlZm94ID0gKHVhLm1hdGNoKC9maXJlZm94L2dpKSAhPT0gbnVsbCk7XG5cdFx0dC5pc1dlYmtpdCA9ICh1YS5tYXRjaCgvd2Via2l0L2dpKSAhPT0gbnVsbCk7XG5cdFx0dC5pc0dlY2tvID0gKHVhLm1hdGNoKC9nZWNrby9naSkgIT09IG51bGwpICYmICF0LmlzV2Via2l0ICYmICF0LmlzSUU7XG5cdFx0dC5pc09wZXJhID0gKHVhLm1hdGNoKC9vcGVyYS9naSkgIT09IG51bGwpO1xuXHRcdHQuaGFzVG91Y2ggPSAoJ29udG91Y2hzdGFydCcgaW4gd2luZG93KTsgLy8gICYmIHdpbmRvdy5vbnRvdWNoc3RhcnQgIT0gbnVsbCk7IC8vIHRoaXMgYnJlYWtzIGlPUyA3XG5cdFx0XG5cdFx0Ly8gYm9ycm93ZWQgZnJvbSBNb2Rlcm5penJcblx0XHR0LnN2ZyA9ICEhIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyAmJlxuXHRcdFx0XHQhISBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJywnc3ZnJykuY3JlYXRlU1ZHUmVjdDtcblxuXHRcdC8vIGNyZWF0ZSBIVE1MNSBtZWRpYSBlbGVtZW50cyBmb3IgSUUgYmVmb3JlIDksIGdldCBhIDx2aWRlbz4gZWxlbWVudCBmb3IgZnVsbHNjcmVlbiBkZXRlY3Rpb25cblx0XHRmb3IgKGk9MDsgaTxodG1sNUVsZW1lbnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHR2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChodG1sNUVsZW1lbnRzW2ldKTtcblx0XHR9XG5cdFx0XG5cdFx0dC5zdXBwb3J0c01lZGlhVGFnID0gKHR5cGVvZiB2LmNhblBsYXlUeXBlICE9PSAndW5kZWZpbmVkJyB8fCB0LmlzQnVzdGVkQW5kcm9pZCk7XG5cblx0XHQvLyBGaXggZm9yIElFOSBvbiBXaW5kb3dzIDdOIC8gV2luZG93cyA3S04gKE1lZGlhIFBsYXllciBub3QgaW5zdGFsbGVyKVxuXHRcdHRyeXtcblx0XHRcdHYuY2FuUGxheVR5cGUoXCJ2aWRlby9tcDRcIik7XG5cdFx0fWNhdGNoKGUpe1xuXHRcdFx0dC5zdXBwb3J0c01lZGlhVGFnID0gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gZGV0ZWN0IG5hdGl2ZSBKYXZhU2NyaXB0IGZ1bGxzY3JlZW4gKFNhZmFyaS9GaXJlZm94IG9ubHksIENocm9tZSBzdGlsbCBmYWlscylcblx0XHRcblx0XHQvLyBpT1Ncblx0XHR0Lmhhc1NlbWlOYXRpdmVGdWxsU2NyZWVuID0gKHR5cGVvZiB2LndlYmtpdEVudGVyRnVsbHNjcmVlbiAhPT0gJ3VuZGVmaW5lZCcpO1xuXHRcdFxuXHRcdC8vIFczQ1xuXHRcdHQuaGFzTmF0aXZlRnVsbHNjcmVlbiA9ICh0eXBlb2Ygdi5yZXF1ZXN0RnVsbHNjcmVlbiAhPT0gJ3VuZGVmaW5lZCcpO1xuXHRcdFxuXHRcdC8vIHdlYmtpdC9maXJlZm94L0lFMTErXG5cdFx0dC5oYXNXZWJraXROYXRpdmVGdWxsU2NyZWVuID0gKHR5cGVvZiB2LndlYmtpdFJlcXVlc3RGdWxsU2NyZWVuICE9PSAndW5kZWZpbmVkJyk7XG5cdFx0dC5oYXNNb3pOYXRpdmVGdWxsU2NyZWVuID0gKHR5cGVvZiB2Lm1velJlcXVlc3RGdWxsU2NyZWVuICE9PSAndW5kZWZpbmVkJyk7XG5cdFx0dC5oYXNNc05hdGl2ZUZ1bGxTY3JlZW4gPSAodHlwZW9mIHYubXNSZXF1ZXN0RnVsbHNjcmVlbiAhPT0gJ3VuZGVmaW5lZCcpO1xuXHRcdFxuXHRcdHQuaGFzVHJ1ZU5hdGl2ZUZ1bGxTY3JlZW4gPSAodC5oYXNXZWJraXROYXRpdmVGdWxsU2NyZWVuIHx8IHQuaGFzTW96TmF0aXZlRnVsbFNjcmVlbiB8fCB0Lmhhc01zTmF0aXZlRnVsbFNjcmVlbik7XG5cdFx0dC5uYXRpdmVGdWxsU2NyZWVuRW5hYmxlZCA9IHQuaGFzVHJ1ZU5hdGl2ZUZ1bGxTY3JlZW47XG5cdFx0XG5cdFx0Ly8gRW5hYmxlZD9cblx0XHRpZiAodC5oYXNNb3pOYXRpdmVGdWxsU2NyZWVuKSB7XG5cdFx0XHR0Lm5hdGl2ZUZ1bGxTY3JlZW5FbmFibGVkID0gZG9jdW1lbnQubW96RnVsbFNjcmVlbkVuYWJsZWQ7XG5cdFx0fSBlbHNlIGlmICh0Lmhhc01zTmF0aXZlRnVsbFNjcmVlbikge1xuXHRcdFx0dC5uYXRpdmVGdWxsU2NyZWVuRW5hYmxlZCA9IGRvY3VtZW50Lm1zRnVsbHNjcmVlbkVuYWJsZWQ7XHRcdFxuXHRcdH1cblx0XHRcblx0XHRpZiAodC5pc0Nocm9tZSkge1xuXHRcdFx0dC5oYXNTZW1pTmF0aXZlRnVsbFNjcmVlbiA9IGZhbHNlO1xuXHRcdH1cblx0XHRcblx0XHRpZiAodC5oYXNUcnVlTmF0aXZlRnVsbFNjcmVlbikge1xuXHRcdFx0XG5cdFx0XHR0LmZ1bGxTY3JlZW5FdmVudE5hbWUgPSAnJztcblx0XHRcdGlmICh0Lmhhc1dlYmtpdE5hdGl2ZUZ1bGxTY3JlZW4pIHsgXG5cdFx0XHRcdHQuZnVsbFNjcmVlbkV2ZW50TmFtZSA9ICd3ZWJraXRmdWxsc2NyZWVuY2hhbmdlJztcblx0XHRcdFx0XG5cdFx0XHR9IGVsc2UgaWYgKHQuaGFzTW96TmF0aXZlRnVsbFNjcmVlbikge1xuXHRcdFx0XHR0LmZ1bGxTY3JlZW5FdmVudE5hbWUgPSAnbW96ZnVsbHNjcmVlbmNoYW5nZSc7XG5cdFx0XHRcdFxuXHRcdFx0fSBlbHNlIGlmICh0Lmhhc01zTmF0aXZlRnVsbFNjcmVlbikge1xuXHRcdFx0XHR0LmZ1bGxTY3JlZW5FdmVudE5hbWUgPSAnTVNGdWxsc2NyZWVuQ2hhbmdlJztcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0dC5pc0Z1bGxTY3JlZW4gPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKHQuaGFzTW96TmF0aXZlRnVsbFNjcmVlbikge1xuXHRcdFx0XHRcdHJldHVybiBkLm1vekZ1bGxTY3JlZW47XG5cdFx0XHRcdFxuXHRcdFx0XHR9IGVsc2UgaWYgKHQuaGFzV2Via2l0TmF0aXZlRnVsbFNjcmVlbikge1xuXHRcdFx0XHRcdHJldHVybiBkLndlYmtpdElzRnVsbFNjcmVlbjtcblx0XHRcdFx0XG5cdFx0XHRcdH0gZWxzZSBpZiAodC5oYXNNc05hdGl2ZUZ1bGxTY3JlZW4pIHtcblx0XHRcdFx0XHRyZXR1cm4gZC5tc0Z1bGxzY3JlZW5FbGVtZW50ICE9PSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHR0LnJlcXVlc3RGdWxsU2NyZWVuID0gZnVuY3Rpb24oZWwpIHtcblx0XHRcblx0XHRcdFx0aWYgKHQuaGFzV2Via2l0TmF0aXZlRnVsbFNjcmVlbikge1xuXHRcdFx0XHRcdGVsLndlYmtpdFJlcXVlc3RGdWxsU2NyZWVuKCk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdH0gZWxzZSBpZiAodC5oYXNNb3pOYXRpdmVGdWxsU2NyZWVuKSB7XG5cdFx0XHRcdFx0ZWwubW96UmVxdWVzdEZ1bGxTY3JlZW4oKTtcblxuXHRcdFx0XHR9IGVsc2UgaWYgKHQuaGFzTXNOYXRpdmVGdWxsU2NyZWVuKSB7XG5cdFx0XHRcdFx0ZWwubXNSZXF1ZXN0RnVsbHNjcmVlbigpO1xuXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0dC5jYW5jZWxGdWxsU2NyZWVuID0gZnVuY3Rpb24oKSB7XHRcdFx0XHRcblx0XHRcdFx0aWYgKHQuaGFzV2Via2l0TmF0aXZlRnVsbFNjcmVlbikge1xuXHRcdFx0XHRcdGRvY3VtZW50LndlYmtpdENhbmNlbEZ1bGxTY3JlZW4oKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0fSBlbHNlIGlmICh0Lmhhc01vek5hdGl2ZUZ1bGxTY3JlZW4pIHtcblx0XHRcdFx0XHRkb2N1bWVudC5tb3pDYW5jZWxGdWxsU2NyZWVuKCk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdH0gZWxzZSBpZiAodC5oYXNNc05hdGl2ZUZ1bGxTY3JlZW4pIHtcblx0XHRcdFx0XHRkb2N1bWVudC5tc0V4aXRGdWxsc2NyZWVuKCk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdH1cblx0XHRcdH1cdFxuXHRcdFx0XG5cdFx0fVxuXHRcdFxuXHRcdFxuXHRcdC8vIE9TIFggMTAuNSBjYW4ndCBkbyB0aGlzIGV2ZW4gaWYgaXQgc2F5cyBpdCBjYW4gOihcblx0XHRpZiAodC5oYXNTZW1pTmF0aXZlRnVsbFNjcmVlbiAmJiB1YS5tYXRjaCgvbWFjIG9zIHggMTBfNS9pKSkge1xuXHRcdFx0dC5oYXNOYXRpdmVGdWxsU2NyZWVuID0gZmFsc2U7XG5cdFx0XHR0Lmhhc1NlbWlOYXRpdmVGdWxsU2NyZWVuID0gZmFsc2U7XG5cdFx0fVxuXHRcdFxuXHR9XG59O1xubWVqcy5NZWRpYUZlYXR1cmVzLmluaXQoKTtcblxuLypcbmV4dGVuc2lvbiBtZXRob2RzIHRvIDx2aWRlbz4gb3IgPGF1ZGlvPiBvYmplY3QgdG8gYnJpbmcgaXQgaW50byBwYXJpdHkgd2l0aCBQbHVnaW5NZWRpYUVsZW1lbnQgKHNlZSBiZWxvdylcbiovXG5tZWpzLkh0bWxNZWRpYUVsZW1lbnQgPSB7XG5cdHBsdWdpblR5cGU6ICduYXRpdmUnLFxuXHRpc0Z1bGxTY3JlZW46IGZhbHNlLFxuXG5cdHNldEN1cnJlbnRUaW1lOiBmdW5jdGlvbiAodGltZSkge1xuXHRcdHRoaXMuY3VycmVudFRpbWUgPSB0aW1lO1xuXHR9LFxuXG5cdHNldE11dGVkOiBmdW5jdGlvbiAobXV0ZWQpIHtcblx0XHR0aGlzLm11dGVkID0gbXV0ZWQ7XG5cdH0sXG5cblx0c2V0Vm9sdW1lOiBmdW5jdGlvbiAodm9sdW1lKSB7XG5cdFx0dGhpcy52b2x1bWUgPSB2b2x1bWU7XG5cdH0sXG5cblx0Ly8gZm9yIHBhcml0eSB3aXRoIHRoZSBwbHVnaW4gdmVyc2lvbnNcblx0c3RvcDogZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMucGF1c2UoKTtcblx0fSxcblxuXHQvLyBUaGlzIGNhbiBiZSBhIHVybCBzdHJpbmdcblx0Ly8gb3IgYW4gYXJyYXkgW3tzcmM6J2ZpbGUubXA0Jyx0eXBlOid2aWRlby9tcDQnfSx7c3JjOidmaWxlLndlYm0nLHR5cGU6J3ZpZGVvL3dlYm0nfV1cblx0c2V0U3JjOiBmdW5jdGlvbiAodXJsKSB7XG5cdFx0XG5cdFx0Ly8gRml4IGZvciBJRTkgd2hpY2ggY2FuJ3Qgc2V0IC5zcmMgd2hlbiB0aGVyZSBhcmUgPHNvdXJjZT4gZWxlbWVudHMuIEF3ZXNvbWUsIHJpZ2h0P1xuXHRcdHZhciBcblx0XHRcdGV4aXN0aW5nU291cmNlcyA9IHRoaXMuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3NvdXJjZScpO1xuXHRcdHdoaWxlIChleGlzdGluZ1NvdXJjZXMubGVuZ3RoID4gMCl7XG5cdFx0XHR0aGlzLnJlbW92ZUNoaWxkKGV4aXN0aW5nU291cmNlc1swXSk7XG5cdFx0fVxuXHRcblx0XHRpZiAodHlwZW9mIHVybCA9PSAnc3RyaW5nJykge1xuXHRcdFx0dGhpcy5zcmMgPSB1cmw7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHZhciBpLCBtZWRpYTtcblxuXHRcdFx0Zm9yIChpPTA7IGk8dXJsLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdG1lZGlhID0gdXJsW2ldO1xuXHRcdFx0XHRpZiAodGhpcy5jYW5QbGF5VHlwZShtZWRpYS50eXBlKSkge1xuXHRcdFx0XHRcdHRoaXMuc3JjID0gbWVkaWEuc3JjO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuXG5cdHNldFZpZGVvU2l6ZTogZnVuY3Rpb24gKHdpZHRoLCBoZWlnaHQpIHtcblx0XHR0aGlzLndpZHRoID0gd2lkdGg7XG5cdFx0dGhpcy5oZWlnaHQgPSBoZWlnaHQ7XG5cdH1cbn07XG5cbi8qXG5NaW1pY3MgdGhlIDx2aWRlby9hdWRpbz4gZWxlbWVudCBieSBjYWxsaW5nIEZsYXNoJ3MgRXh0ZXJuYWwgSW50ZXJmYWNlIG9yIFNpbHZlcmxpZ2h0cyBbU2NyaXB0YWJsZU1lbWJlcl1cbiovXG5tZWpzLlBsdWdpbk1lZGlhRWxlbWVudCA9IGZ1bmN0aW9uIChwbHVnaW5pZCwgcGx1Z2luVHlwZSwgbWVkaWFVcmwpIHtcblx0dGhpcy5pZCA9IHBsdWdpbmlkO1xuXHR0aGlzLnBsdWdpblR5cGUgPSBwbHVnaW5UeXBlO1xuXHR0aGlzLnNyYyA9IG1lZGlhVXJsO1xuXHR0aGlzLmV2ZW50cyA9IHt9O1xuXHR0aGlzLmF0dHJpYnV0ZXMgPSB7fTtcbn07XG5cbi8vIEphdmFTY3JpcHQgdmFsdWVzIGFuZCBFeHRlcm5hbEludGVyZmFjZSBtZXRob2RzIHRoYXQgbWF0Y2ggSFRNTDUgdmlkZW8gcHJvcGVydGllcyBtZXRob2RzXG4vLyBodHRwOi8vd3d3LmFkb2JlLmNvbS9saXZlZG9jcy9mbGFzaC85LjAvQWN0aW9uU2NyaXB0TGFuZ1JlZlYzL2ZsL3ZpZGVvL0ZMVlBsYXliYWNrLmh0bWxcbi8vIGh0dHA6Ly93d3cud2hhdHdnLm9yZy9zcGVjcy93ZWItYXBwcy9jdXJyZW50LXdvcmsvbXVsdGlwYWdlL3ZpZGVvLmh0bWxcbm1lanMuUGx1Z2luTWVkaWFFbGVtZW50LnByb3RvdHlwZSA9IHtcblxuXHQvLyBzcGVjaWFsXG5cdHBsdWdpbkVsZW1lbnQ6IG51bGwsXG5cdHBsdWdpblR5cGU6ICcnLFxuXHRpc0Z1bGxTY3JlZW46IGZhbHNlLFxuXG5cdC8vIG5vdCBpbXBsZW1lbnRlZCA6KFxuXHRwbGF5YmFja1JhdGU6IC0xLFxuXHRkZWZhdWx0UGxheWJhY2tSYXRlOiAtMSxcblx0c2Vla2FibGU6IFtdLFxuXHRwbGF5ZWQ6IFtdLFxuXG5cdC8vIEhUTUw1IHJlYWQtb25seSBwcm9wZXJ0aWVzXG5cdHBhdXNlZDogdHJ1ZSxcblx0ZW5kZWQ6IGZhbHNlLFxuXHRzZWVraW5nOiBmYWxzZSxcblx0ZHVyYXRpb246IDAsXG5cdGVycm9yOiBudWxsLFxuXHR0YWdOYW1lOiAnJyxcblxuXHQvLyBIVE1MNSBnZXQvc2V0IHByb3BlcnRpZXMsIGJ1dCBvbmx5IHNldCAodXBkYXRlZCBieSBldmVudCBoYW5kbGVycylcblx0bXV0ZWQ6IGZhbHNlLFxuXHR2b2x1bWU6IDEsXG5cdGN1cnJlbnRUaW1lOiAwLFxuXG5cdC8vIEhUTUw1IG1ldGhvZHNcblx0cGxheTogZnVuY3Rpb24gKCkge1xuXHRcdGlmICh0aGlzLnBsdWdpbkFwaSAhPSBudWxsKSB7XG5cdFx0XHRpZiAodGhpcy5wbHVnaW5UeXBlID09ICd5b3V0dWJlJyB8fCB0aGlzLnBsdWdpblR5cGUgPT0gJ3ZpbWVvJykge1xuXHRcdFx0XHR0aGlzLnBsdWdpbkFwaS5wbGF5VmlkZW8oKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMucGx1Z2luQXBpLnBsYXlNZWRpYSgpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5wYXVzZWQgPSBmYWxzZTtcblx0XHR9XG5cdH0sXG5cdGxvYWQ6IGZ1bmN0aW9uICgpIHtcblx0XHRpZiAodGhpcy5wbHVnaW5BcGkgIT0gbnVsbCkge1xuXHRcdFx0aWYgKHRoaXMucGx1Z2luVHlwZSA9PSAneW91dHViZScgfHwgdGhpcy5wbHVnaW5UeXBlID09ICd2aW1lbycpIHtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMucGx1Z2luQXBpLmxvYWRNZWRpYSgpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHR0aGlzLnBhdXNlZCA9IGZhbHNlO1xuXHRcdH1cblx0fSxcblx0cGF1c2U6IGZ1bmN0aW9uICgpIHtcblx0XHRpZiAodGhpcy5wbHVnaW5BcGkgIT0gbnVsbCkge1xuXHRcdFx0aWYgKHRoaXMucGx1Z2luVHlwZSA9PSAneW91dHViZScgfHwgdGhpcy5wbHVnaW5UeXBlID09ICd2aW1lbycpIHtcblx0XHRcdFx0dGhpcy5wbHVnaW5BcGkucGF1c2VWaWRlbygpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5wbHVnaW5BcGkucGF1c2VNZWRpYSgpO1xuXHRcdFx0fVx0XHRcdFxuXHRcdFx0XG5cdFx0XHRcblx0XHRcdHRoaXMucGF1c2VkID0gdHJ1ZTtcblx0XHR9XG5cdH0sXG5cdHN0b3A6IGZ1bmN0aW9uICgpIHtcblx0XHRpZiAodGhpcy5wbHVnaW5BcGkgIT0gbnVsbCkge1xuXHRcdFx0aWYgKHRoaXMucGx1Z2luVHlwZSA9PSAneW91dHViZScgfHwgdGhpcy5wbHVnaW5UeXBlID09ICd2aW1lbycpIHtcblx0XHRcdFx0dGhpcy5wbHVnaW5BcGkuc3RvcFZpZGVvKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnBsdWdpbkFwaS5zdG9wTWVkaWEoKTtcblx0XHRcdH1cdFxuXHRcdFx0dGhpcy5wYXVzZWQgPSB0cnVlO1xuXHRcdH1cblx0fSxcblx0Y2FuUGxheVR5cGU6IGZ1bmN0aW9uKHR5cGUpIHtcblx0XHR2YXIgaSxcblx0XHRcdGosXG5cdFx0XHRwbHVnaW5JbmZvLFxuXHRcdFx0cGx1Z2luVmVyc2lvbnMgPSBtZWpzLnBsdWdpbnNbdGhpcy5wbHVnaW5UeXBlXTtcblxuXHRcdGZvciAoaT0wOyBpPHBsdWdpblZlcnNpb25zLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRwbHVnaW5JbmZvID0gcGx1Z2luVmVyc2lvbnNbaV07XG5cblx0XHRcdC8vIHRlc3QgaWYgdXNlciBoYXMgdGhlIGNvcnJlY3QgcGx1Z2luIHZlcnNpb25cblx0XHRcdGlmIChtZWpzLlBsdWdpbkRldGVjdG9yLmhhc1BsdWdpblZlcnNpb24odGhpcy5wbHVnaW5UeXBlLCBwbHVnaW5JbmZvLnZlcnNpb24pKSB7XG5cblx0XHRcdFx0Ly8gdGVzdCBmb3IgcGx1Z2luIHBsYXliYWNrIHR5cGVzXG5cdFx0XHRcdGZvciAoaj0wOyBqPHBsdWdpbkluZm8udHlwZXMubGVuZ3RoOyBqKyspIHtcblx0XHRcdFx0XHQvLyBmaW5kIHBsdWdpbiB0aGF0IGNhbiBwbGF5IHRoZSB0eXBlXG5cdFx0XHRcdFx0aWYgKHR5cGUgPT0gcGx1Z2luSW5mby50eXBlc1tqXSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuICdwcm9iYWJseSc7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuICcnO1xuXHR9LFxuXHRcblx0cG9zaXRpb25GdWxsc2NyZWVuQnV0dG9uOiBmdW5jdGlvbih4LHksdmlzaWJsZUFuZEFib3ZlKSB7XG5cdFx0aWYgKHRoaXMucGx1Z2luQXBpICE9IG51bGwgJiYgdGhpcy5wbHVnaW5BcGkucG9zaXRpb25GdWxsc2NyZWVuQnV0dG9uKSB7XG5cdFx0XHR0aGlzLnBsdWdpbkFwaS5wb3NpdGlvbkZ1bGxzY3JlZW5CdXR0b24oTWF0aC5mbG9vcih4KSxNYXRoLmZsb29yKHkpLHZpc2libGVBbmRBYm92ZSk7XG5cdFx0fVxuXHR9LFxuXHRcblx0aGlkZUZ1bGxzY3JlZW5CdXR0b246IGZ1bmN0aW9uKCkge1xuXHRcdGlmICh0aGlzLnBsdWdpbkFwaSAhPSBudWxsICYmIHRoaXMucGx1Z2luQXBpLmhpZGVGdWxsc2NyZWVuQnV0dG9uKSB7XG5cdFx0XHR0aGlzLnBsdWdpbkFwaS5oaWRlRnVsbHNjcmVlbkJ1dHRvbigpO1xuXHRcdH1cdFx0XG5cdH0sXHRcblx0XG5cblx0Ly8gY3VzdG9tIG1ldGhvZHMgc2luY2Ugbm90IGFsbCBKYXZhU2NyaXB0IGltcGxlbWVudGF0aW9ucyBzdXBwb3J0IGdldC9zZXRcblxuXHQvLyBUaGlzIGNhbiBiZSBhIHVybCBzdHJpbmdcblx0Ly8gb3IgYW4gYXJyYXkgW3tzcmM6J2ZpbGUubXA0Jyx0eXBlOid2aWRlby9tcDQnfSx7c3JjOidmaWxlLndlYm0nLHR5cGU6J3ZpZGVvL3dlYm0nfV1cblx0c2V0U3JjOiBmdW5jdGlvbiAodXJsKSB7XG5cdFx0aWYgKHR5cGVvZiB1cmwgPT0gJ3N0cmluZycpIHtcblx0XHRcdHRoaXMucGx1Z2luQXBpLnNldFNyYyhtZWpzLlV0aWxpdHkuYWJzb2x1dGl6ZVVybCh1cmwpKTtcblx0XHRcdHRoaXMuc3JjID0gbWVqcy5VdGlsaXR5LmFic29sdXRpemVVcmwodXJsKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dmFyIGksIG1lZGlhO1xuXG5cdFx0XHRmb3IgKGk9MDsgaTx1cmwubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0bWVkaWEgPSB1cmxbaV07XG5cdFx0XHRcdGlmICh0aGlzLmNhblBsYXlUeXBlKG1lZGlhLnR5cGUpKSB7XG5cdFx0XHRcdFx0dGhpcy5wbHVnaW5BcGkuc2V0U3JjKG1lanMuVXRpbGl0eS5hYnNvbHV0aXplVXJsKG1lZGlhLnNyYykpO1xuXHRcdFx0XHRcdHRoaXMuc3JjID0gbWVqcy5VdGlsaXR5LmFic29sdXRpemVVcmwodXJsKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHR9LFxuXHRzZXRDdXJyZW50VGltZTogZnVuY3Rpb24gKHRpbWUpIHtcblx0XHRpZiAodGhpcy5wbHVnaW5BcGkgIT0gbnVsbCkge1xuXHRcdFx0aWYgKHRoaXMucGx1Z2luVHlwZSA9PSAneW91dHViZScgfHwgdGhpcy5wbHVnaW5UeXBlID09ICd2aW1lbycpIHtcblx0XHRcdFx0dGhpcy5wbHVnaW5BcGkuc2Vla1RvKHRpbWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5wbHVnaW5BcGkuc2V0Q3VycmVudFRpbWUodGltZSk7XG5cdFx0XHR9XHRcdFx0XHRcblx0XHRcdFxuXHRcdFx0XG5cdFx0XHRcblx0XHRcdHRoaXMuY3VycmVudFRpbWUgPSB0aW1lO1xuXHRcdH1cblx0fSxcblx0c2V0Vm9sdW1lOiBmdW5jdGlvbiAodm9sdW1lKSB7XG5cdFx0aWYgKHRoaXMucGx1Z2luQXBpICE9IG51bGwpIHtcblx0XHRcdC8vIHNhbWUgb24gWW91VHViZSBhbmQgTUVqc1xuXHRcdFx0aWYgKHRoaXMucGx1Z2luVHlwZSA9PSAneW91dHViZScpIHtcblx0XHRcdFx0dGhpcy5wbHVnaW5BcGkuc2V0Vm9sdW1lKHZvbHVtZSAqIDEwMCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnBsdWdpbkFwaS5zZXRWb2x1bWUodm9sdW1lKTtcblx0XHRcdH1cblx0XHRcdHRoaXMudm9sdW1lID0gdm9sdW1lO1xuXHRcdH1cblx0fSxcblx0c2V0TXV0ZWQ6IGZ1bmN0aW9uIChtdXRlZCkge1xuXHRcdGlmICh0aGlzLnBsdWdpbkFwaSAhPSBudWxsKSB7XG5cdFx0XHRpZiAodGhpcy5wbHVnaW5UeXBlID09ICd5b3V0dWJlJykge1xuXHRcdFx0XHRpZiAobXV0ZWQpIHtcblx0XHRcdFx0XHR0aGlzLnBsdWdpbkFwaS5tdXRlKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5wbHVnaW5BcGkudW5NdXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5tdXRlZCA9IG11dGVkO1xuXHRcdFx0XHR0aGlzLmRpc3BhdGNoRXZlbnQoJ3ZvbHVtZWNoYW5nZScpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5wbHVnaW5BcGkuc2V0TXV0ZWQobXV0ZWQpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5tdXRlZCA9IG11dGVkO1xuXHRcdH1cblx0fSxcblxuXHQvLyBhZGRpdGlvbmFsIG5vbi1IVE1MNSBtZXRob2RzXG5cdHNldFZpZGVvU2l6ZTogZnVuY3Rpb24gKHdpZHRoLCBoZWlnaHQpIHtcblx0XHRcblx0XHQvL2lmICh0aGlzLnBsdWdpblR5cGUgPT0gJ2ZsYXNoJyB8fCB0aGlzLnBsdWdpblR5cGUgPT0gJ3NpbHZlcmxpZ2h0Jykge1xuXHRcdFx0aWYgKHRoaXMucGx1Z2luRWxlbWVudCAmJiB0aGlzLnBsdWdpbkVsZW1lbnQuc3R5bGUpIHtcblx0XHRcdFx0dGhpcy5wbHVnaW5FbGVtZW50LnN0eWxlLndpZHRoID0gd2lkdGggKyAncHgnO1xuXHRcdFx0XHR0aGlzLnBsdWdpbkVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gaGVpZ2h0ICsgJ3B4Jztcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLnBsdWdpbkFwaSAhPSBudWxsICYmIHRoaXMucGx1Z2luQXBpLnNldFZpZGVvU2l6ZSkge1xuXHRcdFx0XHR0aGlzLnBsdWdpbkFwaS5zZXRWaWRlb1NpemUod2lkdGgsIGhlaWdodCk7XG5cdFx0XHR9XG5cdFx0Ly99XG5cdH0sXG5cblx0c2V0RnVsbHNjcmVlbjogZnVuY3Rpb24gKGZ1bGxzY3JlZW4pIHtcblx0XHRpZiAodGhpcy5wbHVnaW5BcGkgIT0gbnVsbCAmJiB0aGlzLnBsdWdpbkFwaS5zZXRGdWxsc2NyZWVuKSB7XG5cdFx0XHR0aGlzLnBsdWdpbkFwaS5zZXRGdWxsc2NyZWVuKGZ1bGxzY3JlZW4pO1xuXHRcdH1cblx0fSxcblx0XG5cdGVudGVyRnVsbFNjcmVlbjogZnVuY3Rpb24oKSB7XG5cdFx0aWYgKHRoaXMucGx1Z2luQXBpICE9IG51bGwgJiYgdGhpcy5wbHVnaW5BcGkuc2V0RnVsbHNjcmVlbikge1xuXHRcdFx0dGhpcy5zZXRGdWxsc2NyZWVuKHRydWUpO1xuXHRcdH1cdFx0XG5cdFx0XG5cdH0sXG5cdFxuXHRleGl0RnVsbFNjcmVlbjogZnVuY3Rpb24oKSB7XG5cdFx0aWYgKHRoaXMucGx1Z2luQXBpICE9IG51bGwgJiYgdGhpcy5wbHVnaW5BcGkuc2V0RnVsbHNjcmVlbikge1xuXHRcdFx0dGhpcy5zZXRGdWxsc2NyZWVuKGZhbHNlKTtcblx0XHR9XG5cdH0sXHRcblxuXHQvLyBzdGFydDogZmFrZSBldmVudHNcblx0YWRkRXZlbnRMaXN0ZW5lcjogZnVuY3Rpb24gKGV2ZW50TmFtZSwgY2FsbGJhY2ssIGJ1YmJsZSkge1xuXHRcdHRoaXMuZXZlbnRzW2V2ZW50TmFtZV0gPSB0aGlzLmV2ZW50c1tldmVudE5hbWVdIHx8IFtdO1xuXHRcdHRoaXMuZXZlbnRzW2V2ZW50TmFtZV0ucHVzaChjYWxsYmFjayk7XG5cdH0sXG5cdHJlbW92ZUV2ZW50TGlzdGVuZXI6IGZ1bmN0aW9uIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG5cdFx0aWYgKCFldmVudE5hbWUpIHsgdGhpcy5ldmVudHMgPSB7fTsgcmV0dXJuIHRydWU7IH1cblx0XHR2YXIgY2FsbGJhY2tzID0gdGhpcy5ldmVudHNbZXZlbnROYW1lXTtcblx0XHRpZiAoIWNhbGxiYWNrcykgcmV0dXJuIHRydWU7XG5cdFx0aWYgKCFjYWxsYmFjaykgeyB0aGlzLmV2ZW50c1tldmVudE5hbWVdID0gW107IHJldHVybiB0cnVlOyB9XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBjYWxsYmFja3MubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmIChjYWxsYmFja3NbaV0gPT09IGNhbGxiYWNrKSB7XG5cdFx0XHRcdHRoaXMuZXZlbnRzW2V2ZW50TmFtZV0uc3BsaWNlKGksIDEpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9LFx0XG5cdGRpc3BhdGNoRXZlbnQ6IGZ1bmN0aW9uIChldmVudE5hbWUpIHtcblx0XHR2YXIgaSxcblx0XHRcdGFyZ3MsXG5cdFx0XHRjYWxsYmFja3MgPSB0aGlzLmV2ZW50c1tldmVudE5hbWVdO1xuXG5cdFx0aWYgKGNhbGxiYWNrcykge1xuXHRcdFx0YXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG5cdFx0XHRmb3IgKGkgPSAwOyBpIDwgY2FsbGJhY2tzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNhbGxiYWNrc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcblx0XHRcdH1cblx0XHR9XG5cdH0sXG5cdC8vIGVuZDogZmFrZSBldmVudHNcblx0XG5cdC8vIGZha2UgRE9NIGF0dHJpYnV0ZSBtZXRob2RzXG5cdGhhc0F0dHJpYnV0ZTogZnVuY3Rpb24obmFtZSl7XG5cdFx0cmV0dXJuIChuYW1lIGluIHRoaXMuYXR0cmlidXRlcyk7ICBcblx0fSxcblx0cmVtb3ZlQXR0cmlidXRlOiBmdW5jdGlvbihuYW1lKXtcblx0XHRkZWxldGUgdGhpcy5hdHRyaWJ1dGVzW25hbWVdO1xuXHR9LFxuXHRnZXRBdHRyaWJ1dGU6IGZ1bmN0aW9uKG5hbWUpe1xuXHRcdGlmICh0aGlzLmhhc0F0dHJpYnV0ZShuYW1lKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuYXR0cmlidXRlc1tuYW1lXTtcblx0XHR9XG5cdFx0cmV0dXJuICcnO1xuXHR9LFxuXHRzZXRBdHRyaWJ1dGU6IGZ1bmN0aW9uKG5hbWUsIHZhbHVlKXtcblx0XHR0aGlzLmF0dHJpYnV0ZXNbbmFtZV0gPSB2YWx1ZTtcblx0fSxcblxuXHRyZW1vdmU6IGZ1bmN0aW9uKCkge1xuXHRcdG1lanMuVXRpbGl0eS5yZW1vdmVTd2YodGhpcy5wbHVnaW5FbGVtZW50LmlkKTtcblx0XHRtZWpzLk1lZGlhUGx1Z2luQnJpZGdlLnVucmVnaXN0ZXJQbHVnaW5FbGVtZW50KHRoaXMucGx1Z2luRWxlbWVudC5pZCk7XG5cdH1cbn07XG5cbi8vIEhhbmRsZXMgY2FsbHMgZnJvbSBGbGFzaC9TaWx2ZXJsaWdodCBhbmQgcmVwb3J0cyB0aGVtIGFzIG5hdGl2ZSA8dmlkZW8vYXVkaW8+IGV2ZW50cyBhbmQgcHJvcGVydGllc1xubWVqcy5NZWRpYVBsdWdpbkJyaWRnZSA9IHtcblxuXHRwbHVnaW5NZWRpYUVsZW1lbnRzOnt9LFxuXHRodG1sTWVkaWFFbGVtZW50czp7fSxcblxuXHRyZWdpc3RlclBsdWdpbkVsZW1lbnQ6IGZ1bmN0aW9uIChpZCwgcGx1Z2luTWVkaWFFbGVtZW50LCBodG1sTWVkaWFFbGVtZW50KSB7XG5cdFx0dGhpcy5wbHVnaW5NZWRpYUVsZW1lbnRzW2lkXSA9IHBsdWdpbk1lZGlhRWxlbWVudDtcblx0XHR0aGlzLmh0bWxNZWRpYUVsZW1lbnRzW2lkXSA9IGh0bWxNZWRpYUVsZW1lbnQ7XG5cdH0sXG5cblx0dW5yZWdpc3RlclBsdWdpbkVsZW1lbnQ6IGZ1bmN0aW9uIChpZCkge1xuXHRcdGRlbGV0ZSB0aGlzLnBsdWdpbk1lZGlhRWxlbWVudHNbaWRdO1xuXHRcdGRlbGV0ZSB0aGlzLmh0bWxNZWRpYUVsZW1lbnRzW2lkXTtcblx0fSxcblxuXHQvLyB3aGVuIEZsYXNoL1NpbHZlcmxpZ2h0IGlzIHJlYWR5LCBpdCBjYWxscyBvdXQgdG8gdGhpcyBtZXRob2Rcblx0aW5pdFBsdWdpbjogZnVuY3Rpb24gKGlkKSB7XG5cblx0XHR2YXIgcGx1Z2luTWVkaWFFbGVtZW50ID0gdGhpcy5wbHVnaW5NZWRpYUVsZW1lbnRzW2lkXSxcblx0XHRcdGh0bWxNZWRpYUVsZW1lbnQgPSB0aGlzLmh0bWxNZWRpYUVsZW1lbnRzW2lkXTtcblxuXHRcdGlmIChwbHVnaW5NZWRpYUVsZW1lbnQpIHtcblx0XHRcdC8vIGZpbmQgdGhlIGphdmFzY3JpcHQgYnJpZGdlXG5cdFx0XHRzd2l0Y2ggKHBsdWdpbk1lZGlhRWxlbWVudC5wbHVnaW5UeXBlKSB7XG5cdFx0XHRcdGNhc2UgXCJmbGFzaFwiOlxuXHRcdFx0XHRcdHBsdWdpbk1lZGlhRWxlbWVudC5wbHVnaW5FbGVtZW50ID0gcGx1Z2luTWVkaWFFbGVtZW50LnBsdWdpbkFwaSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlkKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBcInNpbHZlcmxpZ2h0XCI6XG5cdFx0XHRcdFx0cGx1Z2luTWVkaWFFbGVtZW50LnBsdWdpbkVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChwbHVnaW5NZWRpYUVsZW1lbnQuaWQpO1xuXHRcdFx0XHRcdHBsdWdpbk1lZGlhRWxlbWVudC5wbHVnaW5BcGkgPSBwbHVnaW5NZWRpYUVsZW1lbnQucGx1Z2luRWxlbWVudC5Db250ZW50Lk1lZGlhRWxlbWVudEpTO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcblx0XHRcdGlmIChwbHVnaW5NZWRpYUVsZW1lbnQucGx1Z2luQXBpICE9IG51bGwgJiYgcGx1Z2luTWVkaWFFbGVtZW50LnN1Y2Nlc3MpIHtcblx0XHRcdFx0cGx1Z2luTWVkaWFFbGVtZW50LnN1Y2Nlc3MocGx1Z2luTWVkaWFFbGVtZW50LCBodG1sTWVkaWFFbGVtZW50KTtcblx0XHRcdH1cblx0XHR9XG5cdH0sXG5cblx0Ly8gcmVjZWl2ZXMgZXZlbnRzIGZyb20gRmxhc2gvU2lsdmVybGlnaHQgYW5kIHNlbmRzIHRoZW0gb3V0IGFzIEhUTUw1IG1lZGlhIGV2ZW50c1xuXHQvLyBodHRwOi8vd3d3LndoYXR3Zy5vcmcvc3BlY3Mvd2ViLWFwcHMvY3VycmVudC13b3JrL211bHRpcGFnZS92aWRlby5odG1sXG5cdGZpcmVFdmVudDogZnVuY3Rpb24gKGlkLCBldmVudE5hbWUsIHZhbHVlcykge1xuXG5cdFx0dmFyXG5cdFx0XHRlLFxuXHRcdFx0aSxcblx0XHRcdGJ1ZmZlcmVkVGltZSxcblx0XHRcdHBsdWdpbk1lZGlhRWxlbWVudCA9IHRoaXMucGx1Z2luTWVkaWFFbGVtZW50c1tpZF07XG5cblx0XHRpZighcGx1Z2luTWVkaWFFbGVtZW50KXtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcblx0XHQvLyBmYWtlIGV2ZW50IG9iamVjdCB0byBtaW1pYyByZWFsIEhUTUwgbWVkaWEgZXZlbnQuXG5cdFx0ZSA9IHtcblx0XHRcdHR5cGU6IGV2ZW50TmFtZSxcblx0XHRcdHRhcmdldDogcGx1Z2luTWVkaWFFbGVtZW50XG5cdFx0fTtcblxuXHRcdC8vIGF0dGFjaCBhbGwgdmFsdWVzIHRvIGVsZW1lbnQgYW5kIGV2ZW50IG9iamVjdFxuXHRcdGZvciAoaSBpbiB2YWx1ZXMpIHtcblx0XHRcdHBsdWdpbk1lZGlhRWxlbWVudFtpXSA9IHZhbHVlc1tpXTtcblx0XHRcdGVbaV0gPSB2YWx1ZXNbaV07XG5cdFx0fVxuXG5cdFx0Ly8gZmFrZSB0aGUgbmV3ZXIgVzNDIGJ1ZmZlcmVkIFRpbWVSYW5nZSAobG9hZGVkIGFuZCB0b3RhbCBoYXZlIGJlZW4gcmVtb3ZlZClcblx0XHRidWZmZXJlZFRpbWUgPSB2YWx1ZXMuYnVmZmVyZWRUaW1lIHx8IDA7XG5cblx0XHRlLnRhcmdldC5idWZmZXJlZCA9IGUuYnVmZmVyZWQgPSB7XG5cdFx0XHRzdGFydDogZnVuY3Rpb24oaW5kZXgpIHtcblx0XHRcdFx0cmV0dXJuIDA7XG5cdFx0XHR9LFxuXHRcdFx0ZW5kOiBmdW5jdGlvbiAoaW5kZXgpIHtcblx0XHRcdFx0cmV0dXJuIGJ1ZmZlcmVkVGltZTtcblx0XHRcdH0sXG5cdFx0XHRsZW5ndGg6IDFcblx0XHR9O1xuXG5cdFx0cGx1Z2luTWVkaWFFbGVtZW50LmRpc3BhdGNoRXZlbnQoZS50eXBlLCBlKTtcblx0fVxufTtcblxuLypcbkRlZmF1bHQgb3B0aW9uc1xuKi9cbm1lanMuTWVkaWFFbGVtZW50RGVmYXVsdHMgPSB7XG5cdC8vIGFsbG93cyB0ZXN0aW5nIG9uIEhUTUw1LCBmbGFzaCwgc2lsdmVybGlnaHRcblx0Ly8gYXV0bzogYXR0ZW1wdHMgdG8gZGV0ZWN0IHdoYXQgdGhlIGJyb3dzZXIgY2FuIGRvXG5cdC8vIGF1dG9fcGx1Z2luOiBwcmVmZXIgcGx1Z2lucyBhbmQgdGhlbiBhdHRlbXB0IG5hdGl2ZSBIVE1MNVxuXHQvLyBuYXRpdmU6IGZvcmNlcyBIVE1MNSBwbGF5YmFja1xuXHQvLyBzaGltOiBkaXNhbGxvd3MgSFRNTDUsIHdpbGwgYXR0ZW1wdCBlaXRoZXIgRmxhc2ggb3IgU2lsdmVybGlnaHRcblx0Ly8gbm9uZTogZm9yY2VzIGZhbGxiYWNrIHZpZXdcblx0bW9kZTogJ2F1dG8nLFxuXHQvLyByZW1vdmUgb3IgcmVvcmRlciB0byBjaGFuZ2UgcGx1Z2luIHByaW9yaXR5IGFuZCBhdmFpbGFiaWxpdHlcblx0cGx1Z2luczogWydmbGFzaCcsJ3NpbHZlcmxpZ2h0JywneW91dHViZScsJ3ZpbWVvJ10sXG5cdC8vIHNob3dzIGRlYnVnIGVycm9ycyBvbiBzY3JlZW5cblx0ZW5hYmxlUGx1Z2luRGVidWc6IGZhbHNlLFxuXHQvLyB1c2UgcGx1Z2luIGZvciBicm93c2VycyB0aGF0IGhhdmUgdHJvdWJsZSB3aXRoIEJhc2ljIEF1dGhlbnRpY2F0aW9uIG9uIEhUVFBTIHNpdGVzXG5cdGh0dHBzQmFzaWNBdXRoU2l0ZTogZmFsc2UsXG5cdC8vIG92ZXJyaWRlcyB0aGUgdHlwZSBzcGVjaWZpZWQsIHVzZWZ1bCBmb3IgZHluYW1pYyBpbnN0YW50aWF0aW9uXG5cdHR5cGU6ICcnLFxuXHQvLyBwYXRoIHRvIEZsYXNoIGFuZCBTaWx2ZXJsaWdodCBwbHVnaW5zXG5cdHBsdWdpblBhdGg6IG1lanMuVXRpbGl0eS5nZXRTY3JpcHRQYXRoKFsnbWVkaWFlbGVtZW50LmpzJywnbWVkaWFlbGVtZW50Lm1pbi5qcycsJ21lZGlhZWxlbWVudC1hbmQtcGxheWVyLmpzJywnbWVkaWFlbGVtZW50LWFuZC1wbGF5ZXIubWluLmpzJ10pLFxuXHQvLyBuYW1lIG9mIGZsYXNoIGZpbGVcblx0Zmxhc2hOYW1lOiAnZmxhc2htZWRpYWVsZW1lbnQuc3dmJyxcblx0Ly8gc3RyZWFtZXIgZm9yIFJUTVAgc3RyZWFtaW5nXG5cdGZsYXNoU3RyZWFtZXI6ICcnLFxuXHQvLyB0dXJucyBvbiB0aGUgc21vb3RoaW5nIGZpbHRlciBpbiBGbGFzaFxuXHRlbmFibGVQbHVnaW5TbW9vdGhpbmc6IGZhbHNlLFxuXHQvLyBlbmFibGVkIHBzZXVkby1zdHJlYW1pbmcgKHNlZWspIG9uIC5tcDQgZmlsZXNcblx0ZW5hYmxlUHNldWRvU3RyZWFtaW5nOiBmYWxzZSxcblx0Ly8gc3RhcnQgcXVlcnkgcGFyYW1ldGVyIHNlbnQgdG8gc2VydmVyIGZvciBwc2V1ZG8tc3RyZWFtaW5nXG5cdHBzZXVkb1N0cmVhbWluZ1N0YXJ0UXVlcnlQYXJhbTogJ3N0YXJ0Jyxcblx0Ly8gbmFtZSBvZiBzaWx2ZXJsaWdodCBmaWxlXG5cdHNpbHZlcmxpZ2h0TmFtZTogJ3NpbHZlcmxpZ2h0bWVkaWFlbGVtZW50LnhhcCcsXG5cdC8vIGRlZmF1bHQgaWYgdGhlIDx2aWRlbyB3aWR0aD4gaXMgbm90IHNwZWNpZmllZFxuXHRkZWZhdWx0VmlkZW9XaWR0aDogNDgwLFxuXHQvLyBkZWZhdWx0IGlmIHRoZSA8dmlkZW8gaGVpZ2h0PiBpcyBub3Qgc3BlY2lmaWVkXG5cdGRlZmF1bHRWaWRlb0hlaWdodDogMjcwLFxuXHQvLyBvdmVycmlkZXMgPHZpZGVvIHdpZHRoPlxuXHRwbHVnaW5XaWR0aDogLTEsXG5cdC8vIG92ZXJyaWRlcyA8dmlkZW8gaGVpZ2h0PlxuXHRwbHVnaW5IZWlnaHQ6IC0xLFxuXHQvLyBhZGRpdGlvbmFsIHBsdWdpbiB2YXJpYWJsZXMgaW4gJ2tleT12YWx1ZScgZm9ybVxuXHRwbHVnaW5WYXJzOiBbXSxcdFxuXHQvLyByYXRlIGluIG1pbGxpc2Vjb25kcyBmb3IgRmxhc2ggYW5kIFNpbHZlcmxpZ2h0IHRvIGZpcmUgdGhlIHRpbWV1cGRhdGUgZXZlbnRcblx0Ly8gbGFyZ2VyIG51bWJlciBpcyBsZXNzIGFjY3VyYXRlLCBidXQgbGVzcyBzdHJhaW4gb24gcGx1Z2luLT5KYXZhU2NyaXB0IGJyaWRnZVxuXHR0aW1lclJhdGU6IDI1MCxcblx0Ly8gaW5pdGlhbCB2b2x1bWUgZm9yIHBsYXllclxuXHRzdGFydFZvbHVtZTogMC44LFxuXHRzdWNjZXNzOiBmdW5jdGlvbiAoKSB7IH0sXG5cdGVycm9yOiBmdW5jdGlvbiAoKSB7IH1cbn07XG5cbi8qXG5EZXRlcm1pbmVzIGlmIGEgYnJvd3NlciBzdXBwb3J0cyB0aGUgPHZpZGVvPiBvciA8YXVkaW8+IGVsZW1lbnRcbmFuZCByZXR1cm5zIGVpdGhlciB0aGUgbmF0aXZlIGVsZW1lbnQgb3IgYSBGbGFzaC9TaWx2ZXJsaWdodCB2ZXJzaW9uIHRoYXRcbm1pbWljcyBIVE1MNSBNZWRpYUVsZW1lbnRcbiovXG5tZWpzLk1lZGlhRWxlbWVudCA9IGZ1bmN0aW9uIChlbCwgbykge1xuXHRyZXR1cm4gbWVqcy5IdG1sTWVkaWFFbGVtZW50U2hpbS5jcmVhdGUoZWwsbyk7XG59O1xuXG5tZWpzLkh0bWxNZWRpYUVsZW1lbnRTaGltID0ge1xuXG5cdGNyZWF0ZTogZnVuY3Rpb24oZWwsIG8pIHtcblx0XHR2YXJcblx0XHRcdG9wdGlvbnMgPSBtZWpzLk1lZGlhRWxlbWVudERlZmF1bHRzLFxuXHRcdFx0aHRtbE1lZGlhRWxlbWVudCA9ICh0eXBlb2YoZWwpID09ICdzdHJpbmcnKSA/IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGVsKSA6IGVsLFxuXHRcdFx0dGFnTmFtZSA9IGh0bWxNZWRpYUVsZW1lbnQudGFnTmFtZS50b0xvd2VyQ2FzZSgpLFxuXHRcdFx0aXNNZWRpYVRhZyA9ICh0YWdOYW1lID09PSAnYXVkaW8nIHx8IHRhZ05hbWUgPT09ICd2aWRlbycpLFxuXHRcdFx0c3JjID0gKGlzTWVkaWFUYWcpID8gaHRtbE1lZGlhRWxlbWVudC5nZXRBdHRyaWJ1dGUoJ3NyYycpIDogaHRtbE1lZGlhRWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2hyZWYnKSxcblx0XHRcdHBvc3RlciA9IGh0bWxNZWRpYUVsZW1lbnQuZ2V0QXR0cmlidXRlKCdwb3N0ZXInKSxcblx0XHRcdGF1dG9wbGF5ID0gIGh0bWxNZWRpYUVsZW1lbnQuZ2V0QXR0cmlidXRlKCdhdXRvcGxheScpLFxuXHRcdFx0cHJlbG9hZCA9ICBodG1sTWVkaWFFbGVtZW50LmdldEF0dHJpYnV0ZSgncHJlbG9hZCcpLFxuXHRcdFx0Y29udHJvbHMgPSAgaHRtbE1lZGlhRWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2NvbnRyb2xzJyksXG5cdFx0XHRwbGF5YmFjayxcblx0XHRcdHByb3A7XG5cblx0XHQvLyBleHRlbmQgb3B0aW9uc1xuXHRcdGZvciAocHJvcCBpbiBvKSB7XG5cdFx0XHRvcHRpb25zW3Byb3BdID0gb1twcm9wXTtcblx0XHR9XG5cblx0XHQvLyBjbGVhbiB1cCBhdHRyaWJ1dGVzXG5cdFx0c3JjID0gXHRcdCh0eXBlb2Ygc3JjID09ICd1bmRlZmluZWQnIFx0fHwgc3JjID09PSBudWxsIHx8IHNyYyA9PSAnJykgPyBudWxsIDogc3JjO1x0XHRcblx0XHRwb3N0ZXIgPVx0KHR5cGVvZiBwb3N0ZXIgPT0gJ3VuZGVmaW5lZCcgXHR8fCBwb3N0ZXIgPT09IG51bGwpID8gJycgOiBwb3N0ZXI7XG5cdFx0cHJlbG9hZCA9IFx0KHR5cGVvZiBwcmVsb2FkID09ICd1bmRlZmluZWQnIFx0fHwgcHJlbG9hZCA9PT0gbnVsbCB8fCBwcmVsb2FkID09PSAnZmFsc2UnKSA/ICdub25lJyA6IHByZWxvYWQ7XG5cdFx0YXV0b3BsYXkgPSBcdCEodHlwZW9mIGF1dG9wbGF5ID09ICd1bmRlZmluZWQnIHx8IGF1dG9wbGF5ID09PSBudWxsIHx8IGF1dG9wbGF5ID09PSAnZmFsc2UnKTtcblx0XHRjb250cm9scyA9IFx0ISh0eXBlb2YgY29udHJvbHMgPT0gJ3VuZGVmaW5lZCcgfHwgY29udHJvbHMgPT09IG51bGwgfHwgY29udHJvbHMgPT09ICdmYWxzZScpO1xuXG5cdFx0Ly8gdGVzdCBmb3IgSFRNTDUgYW5kIHBsdWdpbiBjYXBhYmlsaXRpZXNcblx0XHRwbGF5YmFjayA9IHRoaXMuZGV0ZXJtaW5lUGxheWJhY2soaHRtbE1lZGlhRWxlbWVudCwgb3B0aW9ucywgbWVqcy5NZWRpYUZlYXR1cmVzLnN1cHBvcnRzTWVkaWFUYWcsIGlzTWVkaWFUYWcsIHNyYyk7XG5cdFx0cGxheWJhY2sudXJsID0gKHBsYXliYWNrLnVybCAhPT0gbnVsbCkgPyBtZWpzLlV0aWxpdHkuYWJzb2x1dGl6ZVVybChwbGF5YmFjay51cmwpIDogJyc7XG5cblx0XHRpZiAocGxheWJhY2subWV0aG9kID09ICduYXRpdmUnKSB7XG5cdFx0XHQvLyBzZWNvbmQgZml4IGZvciBhbmRyb2lkXG5cdFx0XHRpZiAobWVqcy5NZWRpYUZlYXR1cmVzLmlzQnVzdGVkQW5kcm9pZCkge1xuXHRcdFx0XHRodG1sTWVkaWFFbGVtZW50LnNyYyA9IHBsYXliYWNrLnVybDtcblx0XHRcdFx0aHRtbE1lZGlhRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGh0bWxNZWRpYUVsZW1lbnQucGxheSgpO1xuXHRcdFx0XHR9LCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0XG5cdFx0XHQvLyBhZGQgbWV0aG9kcyB0byBuYXRpdmUgSFRNTE1lZGlhRWxlbWVudFxuXHRcdFx0cmV0dXJuIHRoaXMudXBkYXRlTmF0aXZlKHBsYXliYWNrLCBvcHRpb25zLCBhdXRvcGxheSwgcHJlbG9hZCk7XG5cdFx0fSBlbHNlIGlmIChwbGF5YmFjay5tZXRob2QgIT09ICcnKSB7XG5cdFx0XHQvLyBjcmVhdGUgcGx1Z2luIHRvIG1pbWljIEhUTUxNZWRpYUVsZW1lbnRcblx0XHRcdFxuXHRcdFx0cmV0dXJuIHRoaXMuY3JlYXRlUGx1Z2luKCBwbGF5YmFjaywgIG9wdGlvbnMsIHBvc3RlciwgYXV0b3BsYXksIHByZWxvYWQsIGNvbnRyb2xzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gYm9vLCBubyBIVE1MNSwgbm8gRmxhc2gsIG5vIFNpbHZlcmxpZ2h0LlxuXHRcdFx0dGhpcy5jcmVhdGVFcnJvck1lc3NhZ2UoIHBsYXliYWNrLCBvcHRpb25zLCBwb3N0ZXIgKTtcblx0XHRcdFxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHR9LFxuXHRcblx0ZGV0ZXJtaW5lUGxheWJhY2s6IGZ1bmN0aW9uKGh0bWxNZWRpYUVsZW1lbnQsIG9wdGlvbnMsIHN1cHBvcnRzTWVkaWFUYWcsIGlzTWVkaWFUYWcsIHNyYykge1xuXHRcdHZhclxuXHRcdFx0bWVkaWFGaWxlcyA9IFtdLFxuXHRcdFx0aSxcblx0XHRcdGosXG5cdFx0XHRrLFxuXHRcdFx0bCxcblx0XHRcdG4sXG5cdFx0XHR0eXBlLFxuXHRcdFx0cmVzdWx0ID0geyBtZXRob2Q6ICcnLCB1cmw6ICcnLCBodG1sTWVkaWFFbGVtZW50OiBodG1sTWVkaWFFbGVtZW50LCBpc1ZpZGVvOiAoaHRtbE1lZGlhRWxlbWVudC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgIT0gJ2F1ZGlvJyl9LFxuXHRcdFx0cGx1Z2luTmFtZSxcblx0XHRcdHBsdWdpblZlcnNpb25zLFxuXHRcdFx0cGx1Z2luSW5mbyxcblx0XHRcdGR1bW15LFxuXHRcdFx0bWVkaWE7XG5cdFx0XHRcblx0XHQvLyBTVEVQIDE6IEdldCBVUkwgYW5kIHR5cGUgZnJvbSA8dmlkZW8gc3JjPiBvciA8c291cmNlIHNyYz5cblxuXHRcdC8vIHN1cHBsaWVkIHR5cGUgb3ZlcnJpZGVzIDx2aWRlbyB0eXBlPiBhbmQgPHNvdXJjZSB0eXBlPlxuXHRcdGlmICh0eXBlb2Ygb3B0aW9ucy50eXBlICE9ICd1bmRlZmluZWQnICYmIG9wdGlvbnMudHlwZSAhPT0gJycpIHtcblx0XHRcdFxuXHRcdFx0Ly8gYWNjZXB0IGVpdGhlciBzdHJpbmcgb3IgYXJyYXkgb2YgdHlwZXNcblx0XHRcdGlmICh0eXBlb2Ygb3B0aW9ucy50eXBlID09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdG1lZGlhRmlsZXMucHVzaCh7dHlwZTpvcHRpb25zLnR5cGUsIHVybDpzcmN9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFxuXHRcdFx0XHRmb3IgKGk9MDsgaTxvcHRpb25zLnR5cGUubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRtZWRpYUZpbGVzLnB1c2goe3R5cGU6b3B0aW9ucy50eXBlW2ldLCB1cmw6c3JjfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdC8vIHRlc3QgZm9yIHNyYyBhdHRyaWJ1dGUgZmlyc3Rcblx0XHR9IGVsc2UgaWYgKHNyYyAhPT0gbnVsbCkge1xuXHRcdFx0dHlwZSA9IHRoaXMuZm9ybWF0VHlwZShzcmMsIGh0bWxNZWRpYUVsZW1lbnQuZ2V0QXR0cmlidXRlKCd0eXBlJykpO1xuXHRcdFx0bWVkaWFGaWxlcy5wdXNoKHt0eXBlOnR5cGUsIHVybDpzcmN9KTtcblxuXHRcdC8vIHRoZW4gdGVzdCBmb3IgPHNvdXJjZT4gZWxlbWVudHNcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gdGVzdCA8c291cmNlPiB0eXBlcyB0byBzZWUgaWYgdGhleSBhcmUgdXNhYmxlXG5cdFx0XHRmb3IgKGkgPSAwOyBpIDwgaHRtbE1lZGlhRWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdG4gPSBodG1sTWVkaWFFbGVtZW50LmNoaWxkTm9kZXNbaV07XG5cdFx0XHRcdGlmIChuLm5vZGVUeXBlID09IDEgJiYgbi50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT0gJ3NvdXJjZScpIHtcblx0XHRcdFx0XHRzcmMgPSBuLmdldEF0dHJpYnV0ZSgnc3JjJyk7XG5cdFx0XHRcdFx0dHlwZSA9IHRoaXMuZm9ybWF0VHlwZShzcmMsIG4uZ2V0QXR0cmlidXRlKCd0eXBlJykpO1xuXHRcdFx0XHRcdG1lZGlhID0gbi5nZXRBdHRyaWJ1dGUoJ21lZGlhJyk7XG5cblx0XHRcdFx0XHRpZiAoIW1lZGlhIHx8ICF3aW5kb3cubWF0Y2hNZWRpYSB8fCAod2luZG93Lm1hdGNoTWVkaWEgJiYgd2luZG93Lm1hdGNoTWVkaWEobWVkaWEpLm1hdGNoZXMpKSB7XG5cdFx0XHRcdFx0XHRtZWRpYUZpbGVzLnB1c2goe3R5cGU6dHlwZSwgdXJsOnNyY30pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRcblx0XHQvLyBpbiB0aGUgY2FzZSBvZiBkeW5hbWljbHkgY3JlYXRlZCBwbGF5ZXJzXG5cdFx0Ly8gY2hlY2sgZm9yIGF1ZGlvIHR5cGVzXG5cdFx0aWYgKCFpc01lZGlhVGFnICYmIG1lZGlhRmlsZXMubGVuZ3RoID4gMCAmJiBtZWRpYUZpbGVzWzBdLnVybCAhPT0gbnVsbCAmJiB0aGlzLmdldFR5cGVGcm9tRmlsZShtZWRpYUZpbGVzWzBdLnVybCkuaW5kZXhPZignYXVkaW8nKSA+IC0xKSB7XG5cdFx0XHRyZXN1bHQuaXNWaWRlbyA9IGZhbHNlO1xuXHRcdH1cblx0XHRcblxuXHRcdC8vIFNURVAgMjogVGVzdCBmb3IgcGxheWJhY2sgbWV0aG9kXG5cdFx0XG5cdFx0Ly8gc3BlY2lhbCBjYXNlIGZvciBBbmRyb2lkIHdoaWNoIHNhZGx5IGRvZXNuJ3QgaW1wbGVtZW50IHRoZSBjYW5QbGF5VHlwZSBmdW5jdGlvbiAoYWx3YXlzIHJldHVybnMgJycpXG5cdFx0aWYgKG1lanMuTWVkaWFGZWF0dXJlcy5pc0J1c3RlZEFuZHJvaWQpIHtcblx0XHRcdGh0bWxNZWRpYUVsZW1lbnQuY2FuUGxheVR5cGUgPSBmdW5jdGlvbih0eXBlKSB7XG5cdFx0XHRcdHJldHVybiAodHlwZS5tYXRjaCgvdmlkZW9cXC8obXA0fG00dikvZ2kpICE9PSBudWxsKSA/ICdtYXliZScgOiAnJztcblx0XHRcdH07XG5cdFx0fVx0XHRcblx0XHRcblx0XHQvLyBzcGVjaWFsIGNhc2UgZm9yIENocm9taXVtIHRvIHNwZWNpZnkgbmF0aXZlbHkgc3VwcG9ydGVkIHZpZGVvIGNvZGVjcyAoaS5lLiBXZWJNIGFuZCBUaGVvcmEpIFxuXHRcdGlmIChtZWpzLk1lZGlhRmVhdHVyZXMuaXNDaHJvbWl1bSkgeyBcblx0XHRcdGh0bWxNZWRpYUVsZW1lbnQuY2FuUGxheVR5cGUgPSBmdW5jdGlvbih0eXBlKSB7IFxuXHRcdFx0XHRyZXR1cm4gKHR5cGUubWF0Y2goL3ZpZGVvXFwvKHdlYm18b2d2fG9nZykvZ2kpICE9PSBudWxsKSA/ICdtYXliZScgOiAnJzsgXG5cdFx0XHR9OyBcblx0XHR9XG5cblx0XHQvLyB0ZXN0IGZvciBuYXRpdmUgcGxheWJhY2sgZmlyc3Rcblx0XHRpZiAoc3VwcG9ydHNNZWRpYVRhZyAmJiAob3B0aW9ucy5tb2RlID09PSAnYXV0bycgfHwgb3B0aW9ucy5tb2RlID09PSAnYXV0b19wbHVnaW4nIHx8IG9wdGlvbnMubW9kZSA9PT0gJ25hdGl2ZScpICAmJiAhKG1lanMuTWVkaWFGZWF0dXJlcy5pc0J1c3RlZE5hdGl2ZUhUVFBTICYmIG9wdGlvbnMuaHR0cHNCYXNpY0F1dGhTaXRlID09PSB0cnVlKSkge1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRpZiAoIWlzTWVkaWFUYWcpIHtcblxuXHRcdFx0XHQvLyBjcmVhdGUgYSByZWFsIEhUTUw1IE1lZGlhIEVsZW1lbnQgXG5cdFx0XHRcdGR1bW15ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggcmVzdWx0LmlzVmlkZW8gPyAndmlkZW8nIDogJ2F1ZGlvJyk7XHRcdFx0XG5cdFx0XHRcdGh0bWxNZWRpYUVsZW1lbnQucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoZHVtbXksIGh0bWxNZWRpYUVsZW1lbnQpO1xuXHRcdFx0XHRodG1sTWVkaWFFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHRcdFxuXHRcdFx0XHQvLyB1c2UgdGhpcyBvbmUgZnJvbSBub3cgb25cblx0XHRcdFx0cmVzdWx0Lmh0bWxNZWRpYUVsZW1lbnQgPSBodG1sTWVkaWFFbGVtZW50ID0gZHVtbXk7XG5cdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0Zm9yIChpPTA7IGk8bWVkaWFGaWxlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHQvLyBub3JtYWwgY2hlY2tcblx0XHRcdFx0aWYgKG1lZGlhRmlsZXNbaV0udHlwZSA9PSBcInZpZGVvL20zdThcIiB8fCBodG1sTWVkaWFFbGVtZW50LmNhblBsYXlUeXBlKG1lZGlhRmlsZXNbaV0udHlwZSkucmVwbGFjZSgvbm8vLCAnJykgIT09ICcnXG5cdFx0XHRcdFx0Ly8gc3BlY2lhbCBjYXNlIGZvciBNYWMvU2FmYXJpIDUuMC4zIHdoaWNoIGFuc3dlcnMgJycgdG8gY2FuUGxheVR5cGUoJ2F1ZGlvL21wMycpIGJ1dCAnbWF5YmUnIHRvIGNhblBsYXlUeXBlKCdhdWRpby9tcGVnJylcblx0XHRcdFx0XHR8fCBodG1sTWVkaWFFbGVtZW50LmNhblBsYXlUeXBlKG1lZGlhRmlsZXNbaV0udHlwZS5yZXBsYWNlKC9tcDMvLCdtcGVnJykpLnJlcGxhY2UoL25vLywgJycpICE9PSAnJ1xuXHRcdFx0XHRcdC8vIHNwZWNpYWwgY2FzZSBmb3IgbTRhIHN1cHBvcnRlZCBieSBkZXRlY3RpbmcgbXA0IHN1cHBvcnRcblx0XHRcdFx0XHR8fCBodG1sTWVkaWFFbGVtZW50LmNhblBsYXlUeXBlKG1lZGlhRmlsZXNbaV0udHlwZS5yZXBsYWNlKC9tNGEvLCdtcDQnKSkucmVwbGFjZSgvbm8vLCAnJykgIT09ICcnKSB7XG5cdFx0XHRcdFx0cmVzdWx0Lm1ldGhvZCA9ICduYXRpdmUnO1xuXHRcdFx0XHRcdHJlc3VsdC51cmwgPSBtZWRpYUZpbGVzW2ldLnVybDtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVx0XHRcdFxuXHRcdFx0XG5cdFx0XHRpZiAocmVzdWx0Lm1ldGhvZCA9PT0gJ25hdGl2ZScpIHtcblx0XHRcdFx0aWYgKHJlc3VsdC51cmwgIT09IG51bGwpIHtcblx0XHRcdFx0XHRodG1sTWVkaWFFbGVtZW50LnNyYyA9IHJlc3VsdC51cmw7XG5cdFx0XHRcdH1cblx0XHRcdFxuXHRcdFx0XHQvLyBpZiBgYXV0b19wbHVnaW5gIG1vZGUsIHRoZW4gY2FjaGUgdGhlIG5hdGl2ZSByZXN1bHQgYnV0IHRyeSBwbHVnaW5zLlxuXHRcdFx0XHRpZiAob3B0aW9ucy5tb2RlICE9PSAnYXV0b19wbHVnaW4nKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIGlmIG5hdGl2ZSBwbGF5YmFjayBkaWRuJ3Qgd29yaywgdGhlbiB0ZXN0IHBsdWdpbnNcblx0XHRpZiAob3B0aW9ucy5tb2RlID09PSAnYXV0bycgfHwgb3B0aW9ucy5tb2RlID09PSAnYXV0b19wbHVnaW4nIHx8IG9wdGlvbnMubW9kZSA9PT0gJ3NoaW0nKSB7XG5cdFx0XHRmb3IgKGk9MDsgaTxtZWRpYUZpbGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdHR5cGUgPSBtZWRpYUZpbGVzW2ldLnR5cGU7XG5cblx0XHRcdFx0Ly8gdGVzdCBhbGwgcGx1Z2lucyBpbiBvcmRlciBvZiBwcmVmZXJlbmNlIFtzaWx2ZXJsaWdodCwgZmxhc2hdXG5cdFx0XHRcdGZvciAoaj0wOyBqPG9wdGlvbnMucGx1Z2lucy5sZW5ndGg7IGorKykge1xuXG5cdFx0XHRcdFx0cGx1Z2luTmFtZSA9IG9wdGlvbnMucGx1Z2luc1tqXTtcblx0XHRcdFxuXHRcdFx0XHRcdC8vIHRlc3QgdmVyc2lvbiBvZiBwbHVnaW4gKGZvciBmdXR1cmUgZmVhdHVyZXMpXG5cdFx0XHRcdFx0cGx1Z2luVmVyc2lvbnMgPSBtZWpzLnBsdWdpbnNbcGx1Z2luTmFtZV07XHRcdFx0XHRcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRmb3IgKGs9MDsgazxwbHVnaW5WZXJzaW9ucy5sZW5ndGg7IGsrKykge1xuXHRcdFx0XHRcdFx0cGx1Z2luSW5mbyA9IHBsdWdpblZlcnNpb25zW2tdO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0Ly8gdGVzdCBpZiB1c2VyIGhhcyB0aGUgY29ycmVjdCBwbHVnaW4gdmVyc2lvblxuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHQvLyBmb3IgeW91dHViZS92aW1lb1xuXHRcdFx0XHRcdFx0aWYgKHBsdWdpbkluZm8udmVyc2lvbiA9PSBudWxsIHx8IFxuXHRcdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdFx0bWVqcy5QbHVnaW5EZXRlY3Rvci5oYXNQbHVnaW5WZXJzaW9uKHBsdWdpbk5hbWUsIHBsdWdpbkluZm8udmVyc2lvbikpIHtcblxuXHRcdFx0XHRcdFx0XHQvLyB0ZXN0IGZvciBwbHVnaW4gcGxheWJhY2sgdHlwZXNcblx0XHRcdFx0XHRcdFx0Zm9yIChsPTA7IGw8cGx1Z2luSW5mby50eXBlcy5sZW5ndGg7IGwrKykge1xuXHRcdFx0XHRcdFx0XHRcdC8vIGZpbmQgcGx1Z2luIHRoYXQgY2FuIHBsYXkgdGhlIHR5cGVcblx0XHRcdFx0XHRcdFx0XHRpZiAodHlwZSA9PSBwbHVnaW5JbmZvLnR5cGVzW2xdKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXN1bHQubWV0aG9kID0gcGx1Z2luTmFtZTtcblx0XHRcdFx0XHRcdFx0XHRcdHJlc3VsdC51cmwgPSBtZWRpYUZpbGVzW2ldLnVybDtcblx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdFxuXHRcdC8vIGF0IHRoaXMgcG9pbnQsIGJlaW5nIGluICdhdXRvX3BsdWdpbicgbW9kZSBpbXBsaWVzIHRoYXQgd2UgdHJpZWQgcGx1Z2lucyBidXQgZmFpbGVkLlxuXHRcdC8vIGlmIHdlIGhhdmUgbmF0aXZlIHN1cHBvcnQgdGhlbiByZXR1cm4gdGhhdC5cblx0XHRpZiAob3B0aW9ucy5tb2RlID09PSAnYXV0b19wbHVnaW4nICYmIHJlc3VsdC5tZXRob2QgPT09ICduYXRpdmUnKSB7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblxuXHRcdC8vIHdoYXQgaWYgdGhlcmUncyBub3RoaW5nIHRvIHBsYXk/IGp1c3QgZ3JhYiB0aGUgZmlyc3QgYXZhaWxhYmxlXG5cdFx0aWYgKHJlc3VsdC5tZXRob2QgPT09ICcnICYmIG1lZGlhRmlsZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0cmVzdWx0LnVybCA9IG1lZGlhRmlsZXNbMF0udXJsO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH0sXG5cblx0Zm9ybWF0VHlwZTogZnVuY3Rpb24odXJsLCB0eXBlKSB7XG5cdFx0dmFyIGV4dDtcblxuXHRcdC8vIGlmIG5vIHR5cGUgaXMgc3VwcGxpZWQsIGZha2UgaXQgd2l0aCB0aGUgZXh0ZW5zaW9uXG5cdFx0aWYgKHVybCAmJiAhdHlwZSkge1x0XHRcblx0XHRcdHJldHVybiB0aGlzLmdldFR5cGVGcm9tRmlsZSh1cmwpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBvbmx5IHJldHVybiB0aGUgbWltZSBwYXJ0IG9mIHRoZSB0eXBlIGluIGNhc2UgdGhlIGF0dHJpYnV0ZSBjb250YWlucyB0aGUgY29kZWNcblx0XHRcdC8vIHNlZSBodHRwOi8vd3d3LndoYXR3Zy5vcmcvc3BlY3Mvd2ViLWFwcHMvY3VycmVudC13b3JrL211bHRpcGFnZS92aWRlby5odG1sI3RoZS1zb3VyY2UtZWxlbWVudFxuXHRcdFx0Ly8gYHZpZGVvL21wNDsgY29kZWNzPVwiYXZjMS40MkUwMUUsIG1wNGEuNDAuMlwiYCBiZWNvbWVzIGB2aWRlby9tcDRgXG5cdFx0XHRcblx0XHRcdGlmICh0eXBlICYmIH50eXBlLmluZGV4T2YoJzsnKSkge1xuXHRcdFx0XHRyZXR1cm4gdHlwZS5zdWJzdHIoMCwgdHlwZS5pbmRleE9mKCc7JykpOyBcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiB0eXBlO1xuXHRcdFx0fVxuXHRcdH1cblx0fSxcblx0XG5cdGdldFR5cGVGcm9tRmlsZTogZnVuY3Rpb24odXJsKSB7XG5cdFx0dXJsID0gdXJsLnNwbGl0KCc/JylbMF07XG5cdFx0dmFyIGV4dCA9IHVybC5zdWJzdHJpbmcodXJsLmxhc3RJbmRleE9mKCcuJykgKyAxKS50b0xvd2VyQ2FzZSgpO1xuXHRcdHJldHVybiAoLyhtcDR8bTR2fG9nZ3xvZ3Z8bTN1OHx3ZWJtfHdlYm12fGZsdnx3bXZ8bXBlZ3xtb3YpL2dpLnRlc3QoZXh0KSA/ICd2aWRlbycgOiAnYXVkaW8nKSArICcvJyArIHRoaXMuZ2V0VHlwZUZyb21FeHRlbnNpb24oZXh0KTtcblx0fSxcblx0XG5cdGdldFR5cGVGcm9tRXh0ZW5zaW9uOiBmdW5jdGlvbihleHQpIHtcblx0XHRcblx0XHRzd2l0Y2ggKGV4dCkge1xuXHRcdFx0Y2FzZSAnbXA0Jzpcblx0XHRcdGNhc2UgJ200dic6XG5cdFx0XHRjYXNlICdtNGEnOlxuXHRcdFx0XHRyZXR1cm4gJ21wNCc7XG5cdFx0XHRjYXNlICd3ZWJtJzpcblx0XHRcdGNhc2UgJ3dlYm1hJzpcblx0XHRcdGNhc2UgJ3dlYm12JzpcdFxuXHRcdFx0XHRyZXR1cm4gJ3dlYm0nO1xuXHRcdFx0Y2FzZSAnb2dnJzpcblx0XHRcdGNhc2UgJ29nYSc6XG5cdFx0XHRjYXNlICdvZ3YnOlx0XG5cdFx0XHRcdHJldHVybiAnb2dnJztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBleHQ7XG5cdFx0fVxuXHR9LFxuXG5cdGNyZWF0ZUVycm9yTWVzc2FnZTogZnVuY3Rpb24ocGxheWJhY2ssIG9wdGlvbnMsIHBvc3Rlcikge1xuXHRcdHZhciBcblx0XHRcdGh0bWxNZWRpYUVsZW1lbnQgPSBwbGF5YmFjay5odG1sTWVkaWFFbGVtZW50LFxuXHRcdFx0ZXJyb3JDb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdFxuXHRcdGVycm9yQ29udGFpbmVyLmNsYXNzTmFtZSA9ICdtZS1jYW5ub3RwbGF5JztcblxuXHRcdHRyeSB7XG5cdFx0XHRlcnJvckNvbnRhaW5lci5zdHlsZS53aWR0aCA9IGh0bWxNZWRpYUVsZW1lbnQud2lkdGggKyAncHgnO1xuXHRcdFx0ZXJyb3JDb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gaHRtbE1lZGlhRWxlbWVudC5oZWlnaHQgKyAncHgnO1xuXHRcdH0gY2F0Y2ggKGUpIHt9XG5cbiAgICBpZiAob3B0aW9ucy5jdXN0b21FcnJvcikge1xuICAgICAgZXJyb3JDb250YWluZXIuaW5uZXJIVE1MID0gb3B0aW9ucy5jdXN0b21FcnJvcjtcbiAgICB9IGVsc2Uge1xuICAgICAgZXJyb3JDb250YWluZXIuaW5uZXJIVE1MID0gKHBvc3RlciAhPT0gJycpID9cbiAgICAgICAgJzxhIGhyZWY9XCInICsgcGxheWJhY2sudXJsICsgJ1wiPjxpbWcgc3JjPVwiJyArIHBvc3RlciArICdcIiB3aWR0aD1cIjEwMCVcIiBoZWlnaHQ9XCIxMDAlXCIgLz48L2E+JyA6XG4gICAgICAgICc8YSBocmVmPVwiJyArIHBsYXliYWNrLnVybCArICdcIj48c3Bhbj4nICsgbWVqcy5pMThuLnQoJ0Rvd25sb2FkIEZpbGUnKSArICc8L3NwYW4+PC9hPic7XG4gICAgfVxuXG5cdFx0aHRtbE1lZGlhRWxlbWVudC5wYXJlbnROb2RlLmluc2VydEJlZm9yZShlcnJvckNvbnRhaW5lciwgaHRtbE1lZGlhRWxlbWVudCk7XG5cdFx0aHRtbE1lZGlhRWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXG5cdFx0b3B0aW9ucy5lcnJvcihodG1sTWVkaWFFbGVtZW50KTtcblx0fSxcblxuXHRjcmVhdGVQbHVnaW46ZnVuY3Rpb24ocGxheWJhY2ssIG9wdGlvbnMsIHBvc3RlciwgYXV0b3BsYXksIHByZWxvYWQsIGNvbnRyb2xzKSB7XG5cdFx0dmFyIFxuXHRcdFx0aHRtbE1lZGlhRWxlbWVudCA9IHBsYXliYWNrLmh0bWxNZWRpYUVsZW1lbnQsXG5cdFx0XHR3aWR0aCA9IDEsXG5cdFx0XHRoZWlnaHQgPSAxLFxuXHRcdFx0cGx1Z2luaWQgPSAnbWVfJyArIHBsYXliYWNrLm1ldGhvZCArICdfJyArIChtZWpzLm1lSW5kZXgrKyksXG5cdFx0XHRwbHVnaW5NZWRpYUVsZW1lbnQgPSBuZXcgbWVqcy5QbHVnaW5NZWRpYUVsZW1lbnQocGx1Z2luaWQsIHBsYXliYWNrLm1ldGhvZCwgcGxheWJhY2sudXJsKSxcblx0XHRcdGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpLFxuXHRcdFx0c3BlY2lhbElFQ29udGFpbmVyLFxuXHRcdFx0bm9kZSxcblx0XHRcdGluaXRWYXJzO1xuXG5cdFx0Ly8gY29weSB0YWdOYW1lIGZyb20gaHRtbCBtZWRpYSBlbGVtZW50XG5cdFx0cGx1Z2luTWVkaWFFbGVtZW50LnRhZ05hbWUgPSBodG1sTWVkaWFFbGVtZW50LnRhZ05hbWVcblxuXHRcdC8vIGNvcHkgYXR0cmlidXRlcyBmcm9tIGh0bWwgbWVkaWEgZWxlbWVudCB0byBwbHVnaW4gbWVkaWEgZWxlbWVudFxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgaHRtbE1lZGlhRWxlbWVudC5hdHRyaWJ1dGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHR2YXIgYXR0cmlidXRlID0gaHRtbE1lZGlhRWxlbWVudC5hdHRyaWJ1dGVzW2ldO1xuXHRcdFx0aWYgKGF0dHJpYnV0ZS5zcGVjaWZpZWQgPT0gdHJ1ZSkge1xuXHRcdFx0XHRwbHVnaW5NZWRpYUVsZW1lbnQuc2V0QXR0cmlidXRlKGF0dHJpYnV0ZS5uYW1lLCBhdHRyaWJ1dGUudmFsdWUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIGNoZWNrIGZvciBwbGFjZW1lbnQgaW5zaWRlIGEgPHA+IHRhZyAoc29tZXRpbWVzIFdZU0lXWUcgZWRpdG9ycyBkbyB0aGlzKVxuXHRcdG5vZGUgPSBodG1sTWVkaWFFbGVtZW50LnBhcmVudE5vZGU7XG5cdFx0d2hpbGUgKG5vZGUgIT09IG51bGwgJiYgbm9kZS50YWdOYW1lLnRvTG93ZXJDYXNlKCkgIT09ICdib2R5JyAmJiBub2RlLnBhcmVudE5vZGUgIT0gbnVsbCkge1xuXHRcdFx0aWYgKG5vZGUucGFyZW50Tm9kZS50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdwJykge1xuXHRcdFx0XHRub2RlLnBhcmVudE5vZGUucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUobm9kZSwgbm9kZS5wYXJlbnROb2RlKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRub2RlID0gbm9kZS5wYXJlbnROb2RlO1xuXHRcdH1cblxuXHRcdGlmIChwbGF5YmFjay5pc1ZpZGVvKSB7XG5cdFx0XHR3aWR0aCA9IChvcHRpb25zLnBsdWdpbldpZHRoID4gMCkgPyBvcHRpb25zLnBsdWdpbldpZHRoIDogKG9wdGlvbnMudmlkZW9XaWR0aCA+IDApID8gb3B0aW9ucy52aWRlb1dpZHRoIDogKGh0bWxNZWRpYUVsZW1lbnQuZ2V0QXR0cmlidXRlKCd3aWR0aCcpICE9PSBudWxsKSA/IGh0bWxNZWRpYUVsZW1lbnQuZ2V0QXR0cmlidXRlKCd3aWR0aCcpIDogb3B0aW9ucy5kZWZhdWx0VmlkZW9XaWR0aDtcblx0XHRcdGhlaWdodCA9IChvcHRpb25zLnBsdWdpbkhlaWdodCA+IDApID8gb3B0aW9ucy5wbHVnaW5IZWlnaHQgOiAob3B0aW9ucy52aWRlb0hlaWdodCA+IDApID8gb3B0aW9ucy52aWRlb0hlaWdodCA6IChodG1sTWVkaWFFbGVtZW50LmdldEF0dHJpYnV0ZSgnaGVpZ2h0JykgIT09IG51bGwpID8gaHRtbE1lZGlhRWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2hlaWdodCcpIDogb3B0aW9ucy5kZWZhdWx0VmlkZW9IZWlnaHQ7XG5cdFx0XG5cdFx0XHQvLyBpbiBjYXNlIG9mICclJyBtYWtlIHN1cmUgaXQncyBlbmNvZGVkXG5cdFx0XHR3aWR0aCA9IG1lanMuVXRpbGl0eS5lbmNvZGVVcmwod2lkdGgpO1xuXHRcdFx0aGVpZ2h0ID0gbWVqcy5VdGlsaXR5LmVuY29kZVVybChoZWlnaHQpO1xuXHRcdFxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAob3B0aW9ucy5lbmFibGVQbHVnaW5EZWJ1Zykge1xuXHRcdFx0XHR3aWR0aCA9IDMyMDtcblx0XHRcdFx0aGVpZ2h0ID0gMjQwO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIHJlZ2lzdGVyIHBsdWdpblxuXHRcdHBsdWdpbk1lZGlhRWxlbWVudC5zdWNjZXNzID0gb3B0aW9ucy5zdWNjZXNzO1xuXHRcdG1lanMuTWVkaWFQbHVnaW5CcmlkZ2UucmVnaXN0ZXJQbHVnaW5FbGVtZW50KHBsdWdpbmlkLCBwbHVnaW5NZWRpYUVsZW1lbnQsIGh0bWxNZWRpYUVsZW1lbnQpO1xuXG5cdFx0Ly8gYWRkIGNvbnRhaW5lciAobXVzdCBiZSBhZGRlZCB0byBET00gYmVmb3JlIGluc2VydGluZyBIVE1MIGZvciBJRSlcblx0XHRjb250YWluZXIuY2xhc3NOYW1lID0gJ21lLXBsdWdpbic7XG5cdFx0Y29udGFpbmVyLmlkID0gcGx1Z2luaWQgKyAnX2NvbnRhaW5lcic7XG5cdFx0XG5cdFx0aWYgKHBsYXliYWNrLmlzVmlkZW8pIHtcblx0XHRcdFx0aHRtbE1lZGlhRWxlbWVudC5wYXJlbnROb2RlLmluc2VydEJlZm9yZShjb250YWluZXIsIGh0bWxNZWRpYUVsZW1lbnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRcdGRvY3VtZW50LmJvZHkuaW5zZXJ0QmVmb3JlKGNvbnRhaW5lciwgZG9jdW1lbnQuYm9keS5jaGlsZE5vZGVzWzBdKTtcblx0XHR9XG5cblx0XHQvLyBmbGFzaC9zaWx2ZXJsaWdodCB2YXJzXG5cdFx0aW5pdFZhcnMgPSBbXG5cdFx0XHQnaWQ9JyArIHBsdWdpbmlkLFxuXHRcdFx0J2pzaW5pdGZ1bmN0aW9uPScgKyBcIm1lanMuTWVkaWFQbHVnaW5CcmlkZ2UuaW5pdFBsdWdpblwiLFxuXHRcdFx0J2pzY2FsbGJhY2tmdW5jdGlvbj0nICsgXCJtZWpzLk1lZGlhUGx1Z2luQnJpZGdlLmZpcmVFdmVudFwiLFxuXHRcdFx0J2lzdmlkZW89JyArICgocGxheWJhY2suaXNWaWRlbykgPyBcInRydWVcIiA6IFwiZmFsc2VcIiksXG5cdFx0XHQnYXV0b3BsYXk9JyArICgoYXV0b3BsYXkpID8gXCJ0cnVlXCIgOiBcImZhbHNlXCIpLFxuXHRcdFx0J3ByZWxvYWQ9JyArIHByZWxvYWQsXG5cdFx0XHQnd2lkdGg9JyArIHdpZHRoLFxuXHRcdFx0J3N0YXJ0dm9sdW1lPScgKyBvcHRpb25zLnN0YXJ0Vm9sdW1lLFxuXHRcdFx0J3RpbWVycmF0ZT0nICsgb3B0aW9ucy50aW1lclJhdGUsXG5cdFx0XHQnZmxhc2hzdHJlYW1lcj0nICsgb3B0aW9ucy5mbGFzaFN0cmVhbWVyLFxuXHRcdFx0J2hlaWdodD0nICsgaGVpZ2h0LFxuXHRcdFx0J3BzZXVkb3N0cmVhbXN0YXJ0PScgKyBvcHRpb25zLnBzZXVkb1N0cmVhbWluZ1N0YXJ0UXVlcnlQYXJhbV07XG5cblx0XHRpZiAocGxheWJhY2sudXJsICE9PSBudWxsKSB7XG5cdFx0XHRpZiAocGxheWJhY2subWV0aG9kID09ICdmbGFzaCcpIHtcblx0XHRcdFx0aW5pdFZhcnMucHVzaCgnZmlsZT0nICsgbWVqcy5VdGlsaXR5LmVuY29kZVVybChwbGF5YmFjay51cmwpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGluaXRWYXJzLnB1c2goJ2ZpbGU9JyArIHBsYXliYWNrLnVybCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChvcHRpb25zLmVuYWJsZVBsdWdpbkRlYnVnKSB7XG5cdFx0XHRpbml0VmFycy5wdXNoKCdkZWJ1Zz10cnVlJyk7XG5cdFx0fVxuXHRcdGlmIChvcHRpb25zLmVuYWJsZVBsdWdpblNtb290aGluZykge1xuXHRcdFx0aW5pdFZhcnMucHVzaCgnc21vb3RoaW5nPXRydWUnKTtcblx0XHR9XG4gICAgaWYgKG9wdGlvbnMuZW5hYmxlUHNldWRvU3RyZWFtaW5nKSB7XG4gICAgICBpbml0VmFycy5wdXNoKCdwc2V1ZG9zdHJlYW1pbmc9dHJ1ZScpO1xuICAgIH1cblx0XHRpZiAoY29udHJvbHMpIHtcblx0XHRcdGluaXRWYXJzLnB1c2goJ2NvbnRyb2xzPXRydWUnKTsgLy8gc2hvd3MgY29udHJvbHMgaW4gdGhlIHBsdWdpbiBpZiBkZXNpcmVkXG5cdFx0fVxuXHRcdGlmIChvcHRpb25zLnBsdWdpblZhcnMpIHtcblx0XHRcdGluaXRWYXJzID0gaW5pdFZhcnMuY29uY2F0KG9wdGlvbnMucGx1Z2luVmFycyk7XG5cdFx0fVx0XHRcblxuXHRcdHN3aXRjaCAocGxheWJhY2subWV0aG9kKSB7XG5cdFx0XHRjYXNlICdzaWx2ZXJsaWdodCc6XG5cdFx0XHRcdGNvbnRhaW5lci5pbm5lckhUTUwgPVxuJzxvYmplY3QgZGF0YT1cImRhdGE6YXBwbGljYXRpb24veC1zaWx2ZXJsaWdodC0yLFwiIHR5cGU9XCJhcHBsaWNhdGlvbi94LXNpbHZlcmxpZ2h0LTJcIiBpZD1cIicgKyBwbHVnaW5pZCArICdcIiBuYW1lPVwiJyArIHBsdWdpbmlkICsgJ1wiIHdpZHRoPVwiJyArIHdpZHRoICsgJ1wiIGhlaWdodD1cIicgKyBoZWlnaHQgKyAnXCIgY2xhc3M9XCJtZWpzLXNoaW1cIj4nICtcbic8cGFyYW0gbmFtZT1cImluaXRQYXJhbXNcIiB2YWx1ZT1cIicgKyBpbml0VmFycy5qb2luKCcsJykgKyAnXCIgLz4nICtcbic8cGFyYW0gbmFtZT1cIndpbmRvd2xlc3NcIiB2YWx1ZT1cInRydWVcIiAvPicgK1xuJzxwYXJhbSBuYW1lPVwiYmFja2dyb3VuZFwiIHZhbHVlPVwiYmxhY2tcIiAvPicgK1xuJzxwYXJhbSBuYW1lPVwibWluUnVudGltZVZlcnNpb25cIiB2YWx1ZT1cIjMuMC4wLjBcIiAvPicgK1xuJzxwYXJhbSBuYW1lPVwiYXV0b1VwZ3JhZGVcIiB2YWx1ZT1cInRydWVcIiAvPicgK1xuJzxwYXJhbSBuYW1lPVwic291cmNlXCIgdmFsdWU9XCInICsgb3B0aW9ucy5wbHVnaW5QYXRoICsgb3B0aW9ucy5zaWx2ZXJsaWdodE5hbWUgKyAnXCIgLz4nICtcbic8L29iamVjdD4nO1xuXHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlICdmbGFzaCc6XG5cblx0XHRcdFx0aWYgKG1lanMuTWVkaWFGZWF0dXJlcy5pc0lFKSB7XG5cdFx0XHRcdFx0c3BlY2lhbElFQ29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRcdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHNwZWNpYWxJRUNvbnRhaW5lcik7XG5cdFx0XHRcdFx0c3BlY2lhbElFQ29udGFpbmVyLm91dGVySFRNTCA9XG4nPG9iamVjdCBjbGFzc2lkPVwiY2xzaWQ6RDI3Q0RCNkUtQUU2RC0xMWNmLTk2QjgtNDQ0NTUzNTQwMDAwXCIgY29kZWJhc2U9XCIvL2Rvd25sb2FkLm1hY3JvbWVkaWEuY29tL3B1Yi9zaG9ja3dhdmUvY2Ficy9mbGFzaC9zd2ZsYXNoLmNhYlwiICcgK1xuJ2lkPVwiJyArIHBsdWdpbmlkICsgJ1wiIHdpZHRoPVwiJyArIHdpZHRoICsgJ1wiIGhlaWdodD1cIicgKyBoZWlnaHQgKyAnXCIgY2xhc3M9XCJtZWpzLXNoaW1cIj4nICtcbic8cGFyYW0gbmFtZT1cIm1vdmllXCIgdmFsdWU9XCInICsgb3B0aW9ucy5wbHVnaW5QYXRoICsgb3B0aW9ucy5mbGFzaE5hbWUgKyAnP3g9JyArIChuZXcgRGF0ZSgpKSArICdcIiAvPicgK1xuJzxwYXJhbSBuYW1lPVwiZmxhc2h2YXJzXCIgdmFsdWU9XCInICsgaW5pdFZhcnMuam9pbignJmFtcDsnKSArICdcIiAvPicgK1xuJzxwYXJhbSBuYW1lPVwicXVhbGl0eVwiIHZhbHVlPVwiaGlnaFwiIC8+JyArXG4nPHBhcmFtIG5hbWU9XCJiZ2NvbG9yXCIgdmFsdWU9XCIjMDAwMDAwXCIgLz4nICtcbic8cGFyYW0gbmFtZT1cIndtb2RlXCIgdmFsdWU9XCJ0cmFuc3BhcmVudFwiIC8+JyArXG4nPHBhcmFtIG5hbWU9XCJhbGxvd1NjcmlwdEFjY2Vzc1wiIHZhbHVlPVwiYWx3YXlzXCIgLz4nICtcbic8cGFyYW0gbmFtZT1cImFsbG93RnVsbFNjcmVlblwiIHZhbHVlPVwidHJ1ZVwiIC8+JyArXG4nPHBhcmFtIG5hbWU9XCJzY2FsZVwiIHZhbHVlPVwiZGVmYXVsdFwiIC8+JyArIFxuJzwvb2JqZWN0Pic7XG5cblx0XHRcdFx0fSBlbHNlIHtcblxuXHRcdFx0XHRcdGNvbnRhaW5lci5pbm5lckhUTUwgPVxuJzxlbWJlZCBpZD1cIicgKyBwbHVnaW5pZCArICdcIiBuYW1lPVwiJyArIHBsdWdpbmlkICsgJ1wiICcgK1xuJ3BsYXk9XCJ0cnVlXCIgJyArXG4nbG9vcD1cImZhbHNlXCIgJyArXG4ncXVhbGl0eT1cImhpZ2hcIiAnICtcbidiZ2NvbG9yPVwiIzAwMDAwMFwiICcgK1xuJ3dtb2RlPVwidHJhbnNwYXJlbnRcIiAnICtcbidhbGxvd1NjcmlwdEFjY2Vzcz1cImFsd2F5c1wiICcgK1xuJ2FsbG93RnVsbFNjcmVlbj1cInRydWVcIiAnICtcbid0eXBlPVwiYXBwbGljYXRpb24veC1zaG9ja3dhdmUtZmxhc2hcIiBwbHVnaW5zcGFnZT1cIi8vd3d3Lm1hY3JvbWVkaWEuY29tL2dvL2dldGZsYXNocGxheWVyXCIgJyArXG4nc3JjPVwiJyArIG9wdGlvbnMucGx1Z2luUGF0aCArIG9wdGlvbnMuZmxhc2hOYW1lICsgJ1wiICcgK1xuJ2ZsYXNodmFycz1cIicgKyBpbml0VmFycy5qb2luKCcmJykgKyAnXCIgJyArXG4nd2lkdGg9XCInICsgd2lkdGggKyAnXCIgJyArXG4naGVpZ2h0PVwiJyArIGhlaWdodCArICdcIiAnICtcbidzY2FsZT1cImRlZmF1bHRcIicgKyBcbidjbGFzcz1cIm1lanMtc2hpbVwiPjwvZW1iZWQ+Jztcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdFxuXHRcdFx0Y2FzZSAneW91dHViZSc6XG5cdFx0XHRcblx0XHRcdFx0XG5cdFx0XHRcdHZhciB2aWRlb0lkO1xuXHRcdFx0XHQvLyB5b3V0dS5iZSB1cmwgZnJvbSBzaGFyZSBidXR0b25cblx0XHRcdFx0aWYgKHBsYXliYWNrLnVybC5sYXN0SW5kZXhPZihcInlvdXR1LmJlXCIpICE9IC0xKSB7XG5cdFx0XHRcdFx0dmlkZW9JZCA9IHBsYXliYWNrLnVybC5zdWJzdHIocGxheWJhY2sudXJsLmxhc3RJbmRleE9mKCcvJykrMSk7XG5cdFx0XHRcdFx0aWYgKHZpZGVvSWQuaW5kZXhPZignPycpICE9IC0xKSB7XG5cdFx0XHRcdFx0XHR2aWRlb0lkID0gdmlkZW9JZC5zdWJzdHIoMCwgdmlkZW9JZC5pbmRleE9mKCc/JykpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHR2aWRlb0lkID0gcGxheWJhY2sudXJsLnN1YnN0cihwbGF5YmFjay51cmwubGFzdEluZGV4T2YoJz0nKSsxKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR5b3V0dWJlU2V0dGluZ3MgPSB7XG5cdFx0XHRcdFx0XHRjb250YWluZXI6IGNvbnRhaW5lcixcblx0XHRcdFx0XHRcdGNvbnRhaW5lcklkOiBjb250YWluZXIuaWQsXG5cdFx0XHRcdFx0XHRwbHVnaW5NZWRpYUVsZW1lbnQ6IHBsdWdpbk1lZGlhRWxlbWVudCxcblx0XHRcdFx0XHRcdHBsdWdpbklkOiBwbHVnaW5pZCxcblx0XHRcdFx0XHRcdHZpZGVvSWQ6IHZpZGVvSWQsXG5cdFx0XHRcdFx0XHRoZWlnaHQ6IGhlaWdodCxcblx0XHRcdFx0XHRcdHdpZHRoOiB3aWR0aFx0XG5cdFx0XHRcdFx0fTtcdFx0XHRcdFxuXHRcdFx0XHRcblx0XHRcdFx0aWYgKG1lanMuUGx1Z2luRGV0ZWN0b3IuaGFzUGx1Z2luVmVyc2lvbignZmxhc2gnLCBbMTAsMCwwXSkgKSB7XG5cdFx0XHRcdFx0bWVqcy5Zb3VUdWJlQXBpLmNyZWF0ZUZsYXNoKHlvdXR1YmVTZXR0aW5ncyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bWVqcy5Zb3VUdWJlQXBpLmVucXVldWVJZnJhbWUoeW91dHViZVNldHRpbmdzKTtcdFx0XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0XG5cdFx0XHQvLyBERU1PIENvZGUuIERvZXMgTk9UIHdvcmsuXG5cdFx0XHRjYXNlICd2aW1lbyc6XG5cdFx0XHRcdHZhciBwbGF5ZXJfaWQgPSBwbHVnaW5pZCArIFwiX3BsYXllclwiO1xuXHRcdFx0XHRwbHVnaW5NZWRpYUVsZW1lbnQudmltZW9pZCA9IHBsYXliYWNrLnVybC5zdWJzdHIocGxheWJhY2sudXJsLmxhc3RJbmRleE9mKCcvJykrMSk7XG5cdFx0XHRcdFxuXHRcdFx0XHRjb250YWluZXIuaW5uZXJIVE1MID0nPGlmcmFtZSBzcmM9XCIvL3BsYXllci52aW1lby5jb20vdmlkZW8vJyArIHBsdWdpbk1lZGlhRWxlbWVudC52aW1lb2lkICsgJz9hcGk9MSZwb3J0cmFpdD0wJmJ5bGluZT0wJnRpdGxlPTAmcGxheWVyX2lkPScgKyBwbGF5ZXJfaWQgKyAnXCIgd2lkdGg9XCInICsgd2lkdGggKydcIiBoZWlnaHQ9XCInICsgaGVpZ2h0ICsnXCIgZnJhbWVib3JkZXI9XCIwXCIgY2xhc3M9XCJtZWpzLXNoaW1cIiBpZD1cIicgKyBwbGF5ZXJfaWQgKyAnXCIgd2Via2l0YWxsb3dmdWxsc2NyZWVuIG1vemFsbG93ZnVsbHNjcmVlbiBhbGxvd2Z1bGxzY3JlZW4+PC9pZnJhbWU+Jztcblx0XHRcdFx0aWYgKHR5cGVvZigkZikgPT0gJ2Z1bmN0aW9uJykgeyAvLyBmcm9vZ2Fsb29wIGF2YWlsYWJsZVxuXHRcdFx0XHRcdHZhciBwbGF5ZXIgPSAkZihjb250YWluZXIuY2hpbGROb2Rlc1swXSk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0cGxheWVyLmFkZEV2ZW50KCdyZWFkeScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHRwbGF5ZXIucGxheVZpZGVvID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRcdHBsYXllci5hcGkoICdwbGF5JyApO1xuXHRcdFx0XHRcdFx0fSBcblx0XHRcdFx0XHRcdHBsYXllci5zdG9wVmlkZW8gPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0cGxheWVyLmFwaSggJ3VubG9hZCcgKTtcblx0XHRcdFx0XHRcdH0gXG5cdFx0XHRcdFx0XHRwbGF5ZXIucGF1c2VWaWRlbyA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0XHRwbGF5ZXIuYXBpKCAncGF1c2UnICk7XG5cdFx0XHRcdFx0XHR9IFxuXHRcdFx0XHRcdFx0cGxheWVyLnNlZWtUbyA9IGZ1bmN0aW9uKCBzZWNvbmRzICkge1xuXHRcdFx0XHRcdFx0XHRwbGF5ZXIuYXBpKCAnc2Vla1RvJywgc2Vjb25kcyApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cGxheWVyLnNldFZvbHVtZSA9IGZ1bmN0aW9uKCB2b2x1bWUgKSB7XG5cdFx0XHRcdFx0XHRcdHBsYXllci5hcGkoICdzZXRWb2x1bWUnLCB2b2x1bWUgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHBsYXllci5zZXRNdXRlZCA9IGZ1bmN0aW9uKCBtdXRlZCApIHtcblx0XHRcdFx0XHRcdFx0aWYoIG11dGVkICkge1xuXHRcdFx0XHRcdFx0XHRcdHBsYXllci5sYXN0Vm9sdW1lID0gcGxheWVyLmFwaSggJ2dldFZvbHVtZScgKTtcblx0XHRcdFx0XHRcdFx0XHRwbGF5ZXIuYXBpKCAnc2V0Vm9sdW1lJywgMCApO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdHBsYXllci5hcGkoICdzZXRWb2x1bWUnLCBwbGF5ZXIubGFzdFZvbHVtZSApO1xuXHRcdFx0XHRcdFx0XHRcdGRlbGV0ZSBwbGF5ZXIubGFzdFZvbHVtZTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVx0XHRcdFx0XHRcdFxuXG5cdFx0XHRcdFx0XHRmdW5jdGlvbiBjcmVhdGVFdmVudChwbGF5ZXIsIHBsdWdpbk1lZGlhRWxlbWVudCwgZXZlbnROYW1lLCBlKSB7XG5cdFx0XHRcdFx0XHRcdHZhciBvYmogPSB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogZXZlbnROYW1lLFxuXHRcdFx0XHRcdFx0XHRcdHRhcmdldDogcGx1Z2luTWVkaWFFbGVtZW50XG5cdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRcdGlmIChldmVudE5hbWUgPT0gJ3RpbWV1cGRhdGUnKSB7XG5cdFx0XHRcdFx0XHRcdFx0cGx1Z2luTWVkaWFFbGVtZW50LmN1cnJlbnRUaW1lID0gb2JqLmN1cnJlbnRUaW1lID0gZS5zZWNvbmRzO1xuXHRcdFx0XHRcdFx0XHRcdHBsdWdpbk1lZGlhRWxlbWVudC5kdXJhdGlvbiA9IG9iai5kdXJhdGlvbiA9IGUuZHVyYXRpb247XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cGx1Z2luTWVkaWFFbGVtZW50LmRpc3BhdGNoRXZlbnQob2JqLnR5cGUsIG9iaik7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHBsYXllci5hZGRFdmVudCgncGxheScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0XHRjcmVhdGVFdmVudChwbGF5ZXIsIHBsdWdpbk1lZGlhRWxlbWVudCwgJ3BsYXknKTtcblx0XHRcdFx0XHRcdFx0Y3JlYXRlRXZlbnQocGxheWVyLCBwbHVnaW5NZWRpYUVsZW1lbnQsICdwbGF5aW5nJyk7XG5cdFx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdFx0cGxheWVyLmFkZEV2ZW50KCdwYXVzZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0XHRjcmVhdGVFdmVudChwbGF5ZXIsIHBsdWdpbk1lZGlhRWxlbWVudCwgJ3BhdXNlJyk7XG5cdFx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdFx0cGxheWVyLmFkZEV2ZW50KCdmaW5pc2gnLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0Y3JlYXRlRXZlbnQocGxheWVyLCBwbHVnaW5NZWRpYUVsZW1lbnQsICdlbmRlZCcpO1xuXHRcdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRcdHBsYXllci5hZGRFdmVudCgncGxheVByb2dyZXNzJywgZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRcdFx0XHRjcmVhdGVFdmVudChwbGF5ZXIsIHBsdWdpbk1lZGlhRWxlbWVudCwgJ3RpbWV1cGRhdGUnLCBlKTtcblx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0XHRwbHVnaW5NZWRpYUVsZW1lbnQucGx1Z2luRWxlbWVudCA9IGNvbnRhaW5lcjtcblx0XHRcdFx0XHRcdHBsdWdpbk1lZGlhRWxlbWVudC5wbHVnaW5BcGkgPSBwbGF5ZXI7XG5cblx0XHRcdFx0XHRcdC8vIGluaXQgbWVqc1xuXHRcdFx0XHRcdFx0bWVqcy5NZWRpYVBsdWdpbkJyaWRnZS5pbml0UGx1Z2luKHBsdWdpbmlkKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRjb25zb2xlLndhcm4oXCJZb3UgbmVlZCB0byBpbmNsdWRlIGZyb29nYWxvb3AgZm9yIHZpbWVvIHRvIHdvcmtcIik7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XHRcdFx0XG5cdFx0fVxuXHRcdC8vIGhpZGUgb3JpZ2luYWwgZWxlbWVudFxuXHRcdGh0bWxNZWRpYUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHQvLyBwcmV2ZW50IGJyb3dzZXIgZnJvbSBhdXRvcGxheWluZyB3aGVuIHVzaW5nIGEgcGx1Z2luXG5cdFx0aHRtbE1lZGlhRWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoJ2F1dG9wbGF5Jyk7XG5cblx0XHQvLyBGWUk6IG9wdGlvbnMuc3VjY2VzcyB3aWxsIGJlIGZpcmVkIGJ5IHRoZSBNZWRpYVBsdWdpbkJyaWRnZVxuXHRcdFxuXHRcdHJldHVybiBwbHVnaW5NZWRpYUVsZW1lbnQ7XG5cdH0sXG5cblx0dXBkYXRlTmF0aXZlOiBmdW5jdGlvbihwbGF5YmFjaywgb3B0aW9ucywgYXV0b3BsYXksIHByZWxvYWQpIHtcblx0XHRcblx0XHR2YXIgaHRtbE1lZGlhRWxlbWVudCA9IHBsYXliYWNrLmh0bWxNZWRpYUVsZW1lbnQsXG5cdFx0XHRtO1xuXHRcdFxuXHRcdFxuXHRcdC8vIGFkZCBtZXRob2RzIHRvIHZpZGVvIG9iamVjdCB0byBicmluZyBpdCBpbnRvIHBhcml0eSB3aXRoIEZsYXNoIE9iamVjdFxuXHRcdGZvciAobSBpbiBtZWpzLkh0bWxNZWRpYUVsZW1lbnQpIHtcblx0XHRcdGh0bWxNZWRpYUVsZW1lbnRbbV0gPSBtZWpzLkh0bWxNZWRpYUVsZW1lbnRbbV07XG5cdFx0fVxuXG5cdFx0Lypcblx0XHRDaHJvbWUgbm93IHN1cHBvcnRzIHByZWxvYWQ9XCJub25lXCJcblx0XHRpZiAobWVqcy5NZWRpYUZlYXR1cmVzLmlzQ2hyb21lKSB7XG5cdFx0XG5cdFx0XHQvLyBzcGVjaWFsIGNhc2UgdG8gZW5mb3JjZSBwcmVsb2FkIGF0dHJpYnV0ZSAoQ2hyb21lIGRvZXNuJ3QgcmVzcGVjdCB0aGlzKVxuXHRcdFx0aWYgKHByZWxvYWQgPT09ICdub25lJyAmJiAhYXV0b3BsYXkpIHtcblx0XHRcdFxuXHRcdFx0XHQvLyBmb3JjZXMgdGhlIGJyb3dzZXIgdG8gc3RvcCBsb2FkaW5nIChub3RlOiBmYWlscyBpbiBJRTkpXG5cdFx0XHRcdGh0bWxNZWRpYUVsZW1lbnQuc3JjID0gJyc7XG5cdFx0XHRcdGh0bWxNZWRpYUVsZW1lbnQubG9hZCgpO1xuXHRcdFx0XHRodG1sTWVkaWFFbGVtZW50LmNhbmNlbGVkUHJlbG9hZCA9IHRydWU7XG5cblx0XHRcdFx0aHRtbE1lZGlhRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdwbGF5JyxmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRpZiAoaHRtbE1lZGlhRWxlbWVudC5jYW5jZWxlZFByZWxvYWQpIHtcblx0XHRcdFx0XHRcdGh0bWxNZWRpYUVsZW1lbnQuc3JjID0gcGxheWJhY2sudXJsO1xuXHRcdFx0XHRcdFx0aHRtbE1lZGlhRWxlbWVudC5sb2FkKCk7XG5cdFx0XHRcdFx0XHRodG1sTWVkaWFFbGVtZW50LnBsYXkoKTtcblx0XHRcdFx0XHRcdGh0bWxNZWRpYUVsZW1lbnQuY2FuY2VsZWRQcmVsb2FkID0gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCBmYWxzZSk7XG5cdFx0XHQvLyBmb3Igc29tZSByZWFzb24gQ2hyb21lIGZvcmdldHMgaG93IHRvIGF1dG9wbGF5IHNvbWV0aW1lcy5cblx0XHRcdH0gZWxzZSBpZiAoYXV0b3BsYXkpIHtcblx0XHRcdFx0aHRtbE1lZGlhRWxlbWVudC5sb2FkKCk7XG5cdFx0XHRcdGh0bWxNZWRpYUVsZW1lbnQucGxheSgpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHQqL1xuXG5cdFx0Ly8gZmlyZSBzdWNjZXNzIGNvZGVcblx0XHRvcHRpb25zLnN1Y2Nlc3MoaHRtbE1lZGlhRWxlbWVudCwgaHRtbE1lZGlhRWxlbWVudCk7XG5cdFx0XG5cdFx0cmV0dXJuIGh0bWxNZWRpYUVsZW1lbnQ7XG5cdH1cbn07XG5cbi8qXG4gLSB0ZXN0IG9uIElFIChvYmplY3QgdnMuIGVtYmVkKVxuIC0gZGV0ZXJtaW5lIHdoZW4gdG8gdXNlIGlmcmFtZSAoRmlyZWZveCwgU2FmYXJpLCBNb2JpbGUpIHZzLiBGbGFzaCAoQ2hyb21lLCBJRSlcbiAtIGZ1bGxzY3JlZW4/XG4qL1xuXG4vLyBZb3VUdWJlIEZsYXNoIGFuZCBJZnJhbWUgQVBJXG5tZWpzLllvdVR1YmVBcGkgPSB7XG5cdGlzSWZyYW1lU3RhcnRlZDogZmFsc2UsXG5cdGlzSWZyYW1lTG9hZGVkOiBmYWxzZSxcblx0bG9hZElmcmFtZUFwaTogZnVuY3Rpb24oKSB7XG5cdFx0aWYgKCF0aGlzLmlzSWZyYW1lU3RhcnRlZCkge1xuXHRcdFx0dmFyIHRhZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuXHRcdFx0dGFnLnNyYyA9IFwiLy93d3cueW91dHViZS5jb20vcGxheWVyX2FwaVwiO1xuXHRcdFx0dmFyIGZpcnN0U2NyaXB0VGFnID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3NjcmlwdCcpWzBdO1xuXHRcdFx0Zmlyc3RTY3JpcHRUYWcucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUodGFnLCBmaXJzdFNjcmlwdFRhZyk7XG5cdFx0XHR0aGlzLmlzSWZyYW1lU3RhcnRlZCA9IHRydWU7XG5cdFx0fVxuXHR9LFxuXHRpZnJhbWVRdWV1ZTogW10sXG5cdGVucXVldWVJZnJhbWU6IGZ1bmN0aW9uKHl0KSB7XG5cdFx0XG5cdFx0aWYgKHRoaXMuaXNMb2FkZWQpIHtcblx0XHRcdHRoaXMuY3JlYXRlSWZyYW1lKHl0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5sb2FkSWZyYW1lQXBpKCk7XG5cdFx0XHR0aGlzLmlmcmFtZVF1ZXVlLnB1c2goeXQpO1xuXHRcdH1cblx0fSxcblx0Y3JlYXRlSWZyYW1lOiBmdW5jdGlvbihzZXR0aW5ncykge1xuXHRcdFxuXHRcdHZhclxuXHRcdHBsdWdpbk1lZGlhRWxlbWVudCA9IHNldHRpbmdzLnBsdWdpbk1lZGlhRWxlbWVudCxcdFxuXHRcdHBsYXllciA9IG5ldyBZVC5QbGF5ZXIoc2V0dGluZ3MuY29udGFpbmVySWQsIHtcblx0XHRcdGhlaWdodDogc2V0dGluZ3MuaGVpZ2h0LFxuXHRcdFx0d2lkdGg6IHNldHRpbmdzLndpZHRoLFxuXHRcdFx0dmlkZW9JZDogc2V0dGluZ3MudmlkZW9JZCxcblx0XHRcdHBsYXllclZhcnM6IHtjb250cm9sczowfSxcblx0XHRcdGV2ZW50czoge1xuXHRcdFx0XHQnb25SZWFkeSc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vIGhvb2sgdXAgaWZyYW1lIG9iamVjdCB0byBNRWpzXG5cdFx0XHRcdFx0c2V0dGluZ3MucGx1Z2luTWVkaWFFbGVtZW50LnBsdWdpbkFwaSA9IHBsYXllcjtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQvLyBpbml0IG1lanNcblx0XHRcdFx0XHRtZWpzLk1lZGlhUGx1Z2luQnJpZGdlLmluaXRQbHVnaW4oc2V0dGluZ3MucGx1Z2luSWQpO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vIGNyZWF0ZSB0aW1lclxuXHRcdFx0XHRcdHNldEludGVydmFsKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0bWVqcy5Zb3VUdWJlQXBpLmNyZWF0ZUV2ZW50KHBsYXllciwgcGx1Z2luTWVkaWFFbGVtZW50LCAndGltZXVwZGF0ZScpO1xuXHRcdFx0XHRcdH0sIDI1MCk7XHRcdFx0XHRcdFxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnb25TdGF0ZUNoYW5nZSc6IGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRtZWpzLllvdVR1YmVBcGkuaGFuZGxlU3RhdGVDaGFuZ2UoZS5kYXRhLCBwbGF5ZXIsIHBsdWdpbk1lZGlhRWxlbWVudCk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fSxcblx0XG5cdGNyZWF0ZUV2ZW50OiBmdW5jdGlvbiAocGxheWVyLCBwbHVnaW5NZWRpYUVsZW1lbnQsIGV2ZW50TmFtZSkge1xuXHRcdHZhciBvYmogPSB7XG5cdFx0XHR0eXBlOiBldmVudE5hbWUsXG5cdFx0XHR0YXJnZXQ6IHBsdWdpbk1lZGlhRWxlbWVudFxuXHRcdH07XG5cblx0XHRpZiAocGxheWVyICYmIHBsYXllci5nZXREdXJhdGlvbikge1xuXHRcdFx0XG5cdFx0XHQvLyB0aW1lIFxuXHRcdFx0cGx1Z2luTWVkaWFFbGVtZW50LmN1cnJlbnRUaW1lID0gb2JqLmN1cnJlbnRUaW1lID0gcGxheWVyLmdldEN1cnJlbnRUaW1lKCk7XG5cdFx0XHRwbHVnaW5NZWRpYUVsZW1lbnQuZHVyYXRpb24gPSBvYmouZHVyYXRpb24gPSBwbGF5ZXIuZ2V0RHVyYXRpb24oKTtcblx0XHRcdFxuXHRcdFx0Ly8gc3RhdGVcblx0XHRcdG9iai5wYXVzZWQgPSBwbHVnaW5NZWRpYUVsZW1lbnQucGF1c2VkO1xuXHRcdFx0b2JqLmVuZGVkID0gcGx1Z2luTWVkaWFFbGVtZW50LmVuZGVkO1x0XHRcdFxuXHRcdFx0XG5cdFx0XHQvLyBzb3VuZFxuXHRcdFx0b2JqLm11dGVkID0gcGxheWVyLmlzTXV0ZWQoKTtcblx0XHRcdG9iai52b2x1bWUgPSBwbGF5ZXIuZ2V0Vm9sdW1lKCkgLyAxMDA7XG5cdFx0XHRcblx0XHRcdC8vIHByb2dyZXNzXG5cdFx0XHRvYmouYnl0ZXNUb3RhbCA9IHBsYXllci5nZXRWaWRlb0J5dGVzVG90YWwoKTtcblx0XHRcdG9iai5idWZmZXJlZEJ5dGVzID0gcGxheWVyLmdldFZpZGVvQnl0ZXNMb2FkZWQoKTtcblx0XHRcdFxuXHRcdFx0Ly8gZmFrZSB0aGUgVzNDIGJ1ZmZlcmVkIFRpbWVSYW5nZVxuXHRcdFx0dmFyIGJ1ZmZlcmVkVGltZSA9IG9iai5idWZmZXJlZEJ5dGVzIC8gb2JqLmJ5dGVzVG90YWwgKiBvYmouZHVyYXRpb247XG5cdFx0XHRcblx0XHRcdG9iai50YXJnZXQuYnVmZmVyZWQgPSBvYmouYnVmZmVyZWQgPSB7XG5cdFx0XHRcdHN0YXJ0OiBmdW5jdGlvbihpbmRleCkge1xuXHRcdFx0XHRcdHJldHVybiAwO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRlbmQ6IGZ1bmN0aW9uIChpbmRleCkge1xuXHRcdFx0XHRcdHJldHVybiBidWZmZXJlZFRpbWU7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGxlbmd0aDogMVxuXHRcdFx0fTtcblxuXHRcdH1cblx0XHRcblx0XHQvLyBzZW5kIGV2ZW50IHVwIHRoZSBjaGFpblxuXHRcdHBsdWdpbk1lZGlhRWxlbWVudC5kaXNwYXRjaEV2ZW50KG9iai50eXBlLCBvYmopO1xuXHR9LFx0XG5cdFxuXHRpRnJhbWVSZWFkeTogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dGhpcy5pc0xvYWRlZCA9IHRydWU7XG5cdFx0dGhpcy5pc0lmcmFtZUxvYWRlZCA9IHRydWU7XG5cdFx0XG5cdFx0d2hpbGUgKHRoaXMuaWZyYW1lUXVldWUubGVuZ3RoID4gMCkge1xuXHRcdFx0dmFyIHNldHRpbmdzID0gdGhpcy5pZnJhbWVRdWV1ZS5wb3AoKTtcblx0XHRcdHRoaXMuY3JlYXRlSWZyYW1lKHNldHRpbmdzKTtcblx0XHR9XHRcblx0fSxcblx0XG5cdC8vIEZMQVNIIVxuXHRmbGFzaFBsYXllcnM6IHt9LFxuXHRjcmVhdGVGbGFzaDogZnVuY3Rpb24oc2V0dGluZ3MpIHtcblx0XHRcblx0XHR0aGlzLmZsYXNoUGxheWVyc1tzZXR0aW5ncy5wbHVnaW5JZF0gPSBzZXR0aW5ncztcblx0XHRcblx0XHQvKlxuXHRcdHNldHRpbmdzLmNvbnRhaW5lci5pbm5lckhUTUwgPVxuXHRcdFx0JzxvYmplY3QgdHlwZT1cImFwcGxpY2F0aW9uL3gtc2hvY2t3YXZlLWZsYXNoXCIgaWQ9XCInICsgc2V0dGluZ3MucGx1Z2luSWQgKyAnXCIgZGF0YT1cIi8vd3d3LnlvdXR1YmUuY29tL2FwaXBsYXllcj9lbmFibGVqc2FwaT0xJmFtcDtwbGF5ZXJhcGlpZD0nICsgc2V0dGluZ3MucGx1Z2luSWQgICsgJyZhbXA7dmVyc2lvbj0zJmFtcDthdXRvcGxheT0wJmFtcDtjb250cm9scz0wJmFtcDttb2Rlc3RicmFuZGluZz0xJmxvb3A9MFwiICcgK1xuXHRcdFx0XHQnd2lkdGg9XCInICsgc2V0dGluZ3Mud2lkdGggKyAnXCIgaGVpZ2h0PVwiJyArIHNldHRpbmdzLmhlaWdodCArICdcIiBzdHlsZT1cInZpc2liaWxpdHk6IHZpc2libGU7IFwiIGNsYXNzPVwibWVqcy1zaGltXCI+JyArXG5cdFx0XHRcdCc8cGFyYW0gbmFtZT1cImFsbG93U2NyaXB0QWNjZXNzXCIgdmFsdWU9XCJhbHdheXNcIj4nICtcblx0XHRcdFx0JzxwYXJhbSBuYW1lPVwid21vZGVcIiB2YWx1ZT1cInRyYW5zcGFyZW50XCI+JyArXG5cdFx0XHQnPC9vYmplY3Q+Jztcblx0XHQqL1xuXG5cdFx0dmFyIHNwZWNpYWxJRUNvbnRhaW5lcixcblx0XHRcdHlvdXR1YmVVcmwgPSAnLy93d3cueW91dHViZS5jb20vYXBpcGxheWVyP2VuYWJsZWpzYXBpPTEmYW1wO3BsYXllcmFwaWlkPScgKyBzZXR0aW5ncy5wbHVnaW5JZCAgKyAnJmFtcDt2ZXJzaW9uPTMmYW1wO2F1dG9wbGF5PTAmYW1wO2NvbnRyb2xzPTAmYW1wO21vZGVzdGJyYW5kaW5nPTEmbG9vcD0wJztcblx0XHRcdFxuXHRcdGlmIChtZWpzLk1lZGlhRmVhdHVyZXMuaXNJRSkge1xuXHRcdFx0XG5cdFx0XHRzcGVjaWFsSUVDb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdHNldHRpbmdzLmNvbnRhaW5lci5hcHBlbmRDaGlsZChzcGVjaWFsSUVDb250YWluZXIpO1xuXHRcdFx0c3BlY2lhbElFQ29udGFpbmVyLm91dGVySFRNTCA9ICc8b2JqZWN0IGNsYXNzaWQ9XCJjbHNpZDpEMjdDREI2RS1BRTZELTExY2YtOTZCOC00NDQ1NTM1NDAwMDBcIiBjb2RlYmFzZT1cIi8vZG93bmxvYWQubWFjcm9tZWRpYS5jb20vcHViL3Nob2Nrd2F2ZS9jYWJzL2ZsYXNoL3N3Zmxhc2guY2FiXCIgJyArXG4naWQ9XCInICsgc2V0dGluZ3MucGx1Z2luSWQgKyAnXCIgd2lkdGg9XCInICsgc2V0dGluZ3Mud2lkdGggKyAnXCIgaGVpZ2h0PVwiJyArIHNldHRpbmdzLmhlaWdodCArICdcIiBjbGFzcz1cIm1lanMtc2hpbVwiPicgK1xuXHQnPHBhcmFtIG5hbWU9XCJtb3ZpZVwiIHZhbHVlPVwiJyArIHlvdXR1YmVVcmwgKyAnXCIgLz4nICtcblx0JzxwYXJhbSBuYW1lPVwid21vZGVcIiB2YWx1ZT1cInRyYW5zcGFyZW50XCIgLz4nICtcblx0JzxwYXJhbSBuYW1lPVwiYWxsb3dTY3JpcHRBY2Nlc3NcIiB2YWx1ZT1cImFsd2F5c1wiIC8+JyArXG5cdCc8cGFyYW0gbmFtZT1cImFsbG93RnVsbFNjcmVlblwiIHZhbHVlPVwidHJ1ZVwiIC8+JyArXG4nPC9vYmplY3Q+Jztcblx0XHR9IGVsc2Uge1xuXHRcdHNldHRpbmdzLmNvbnRhaW5lci5pbm5lckhUTUwgPVxuXHRcdFx0JzxvYmplY3QgdHlwZT1cImFwcGxpY2F0aW9uL3gtc2hvY2t3YXZlLWZsYXNoXCIgaWQ9XCInICsgc2V0dGluZ3MucGx1Z2luSWQgKyAnXCIgZGF0YT1cIicgKyB5b3V0dWJlVXJsICsgJ1wiICcgK1xuXHRcdFx0XHQnd2lkdGg9XCInICsgc2V0dGluZ3Mud2lkdGggKyAnXCIgaGVpZ2h0PVwiJyArIHNldHRpbmdzLmhlaWdodCArICdcIiBzdHlsZT1cInZpc2liaWxpdHk6IHZpc2libGU7IFwiIGNsYXNzPVwibWVqcy1zaGltXCI+JyArXG5cdFx0XHRcdCc8cGFyYW0gbmFtZT1cImFsbG93U2NyaXB0QWNjZXNzXCIgdmFsdWU9XCJhbHdheXNcIj4nICtcblx0XHRcdFx0JzxwYXJhbSBuYW1lPVwid21vZGVcIiB2YWx1ZT1cInRyYW5zcGFyZW50XCI+JyArXG5cdFx0XHQnPC9vYmplY3Q+Jztcblx0XHR9XHRcdFxuXHRcdFxuXHR9LFxuXHRcblx0Zmxhc2hSZWFkeTogZnVuY3Rpb24oaWQpIHtcblx0XHR2YXJcblx0XHRcdHNldHRpbmdzID0gdGhpcy5mbGFzaFBsYXllcnNbaWRdLFxuXHRcdFx0cGxheWVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpLFxuXHRcdFx0cGx1Z2luTWVkaWFFbGVtZW50ID0gc2V0dGluZ3MucGx1Z2luTWVkaWFFbGVtZW50O1xuXHRcdFxuXHRcdC8vIGhvb2sgdXAgYW5kIHJldHVybiB0byBNZWRpYUVMZW1lbnRQbGF5ZXIuc3VjY2Vzc1x0XG5cdFx0cGx1Z2luTWVkaWFFbGVtZW50LnBsdWdpbkFwaSA9IFxuXHRcdHBsdWdpbk1lZGlhRWxlbWVudC5wbHVnaW5FbGVtZW50ID0gcGxheWVyO1xuXHRcdG1lanMuTWVkaWFQbHVnaW5CcmlkZ2UuaW5pdFBsdWdpbihpZCk7XG5cdFx0XG5cdFx0Ly8gbG9hZCB0aGUgeW91dHViZSB2aWRlb1xuXHRcdHBsYXllci5jdWVWaWRlb0J5SWQoc2V0dGluZ3MudmlkZW9JZCk7XG5cdFx0XG5cdFx0dmFyIGNhbGxiYWNrTmFtZSA9IHNldHRpbmdzLmNvbnRhaW5lcklkICsgJ19jYWxsYmFjayc7XG5cdFx0XG5cdFx0d2luZG93W2NhbGxiYWNrTmFtZV0gPSBmdW5jdGlvbihlKSB7XG5cdFx0XHRtZWpzLllvdVR1YmVBcGkuaGFuZGxlU3RhdGVDaGFuZ2UoZSwgcGxheWVyLCBwbHVnaW5NZWRpYUVsZW1lbnQpO1xuXHRcdH1cblx0XHRcblx0XHRwbGF5ZXIuYWRkRXZlbnRMaXN0ZW5lcignb25TdGF0ZUNoYW5nZScsIGNhbGxiYWNrTmFtZSk7XG5cdFx0XG5cdFx0c2V0SW50ZXJ2YWwoZnVuY3Rpb24oKSB7XG5cdFx0XHRtZWpzLllvdVR1YmVBcGkuY3JlYXRlRXZlbnQocGxheWVyLCBwbHVnaW5NZWRpYUVsZW1lbnQsICd0aW1ldXBkYXRlJyk7XG5cdFx0fSwgMjUwKTtcblx0XHRcblx0XHRtZWpzLllvdVR1YmVBcGkuY3JlYXRlRXZlbnQocGxheWVyLCBwbHVnaW5NZWRpYUVsZW1lbnQsICdjYW5wbGF5Jyk7XG5cdH0sXG5cdFxuXHRoYW5kbGVTdGF0ZUNoYW5nZTogZnVuY3Rpb24oeW91VHViZVN0YXRlLCBwbGF5ZXIsIHBsdWdpbk1lZGlhRWxlbWVudCkge1xuXHRcdHN3aXRjaCAoeW91VHViZVN0YXRlKSB7XG5cdFx0XHRjYXNlIC0xOiAvLyBub3Qgc3RhcnRlZFxuXHRcdFx0XHRwbHVnaW5NZWRpYUVsZW1lbnQucGF1c2VkID0gdHJ1ZTtcblx0XHRcdFx0cGx1Z2luTWVkaWFFbGVtZW50LmVuZGVkID0gdHJ1ZTtcblx0XHRcdFx0bWVqcy5Zb3VUdWJlQXBpLmNyZWF0ZUV2ZW50KHBsYXllciwgcGx1Z2luTWVkaWFFbGVtZW50LCAnbG9hZGVkbWV0YWRhdGEnKTtcblx0XHRcdFx0Ly9jcmVhdGVZb3VUdWJlRXZlbnQocGxheWVyLCBwbHVnaW5NZWRpYUVsZW1lbnQsICdsb2FkZWRkYXRhJyk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAwOlxuXHRcdFx0XHRwbHVnaW5NZWRpYUVsZW1lbnQucGF1c2VkID0gZmFsc2U7XG5cdFx0XHRcdHBsdWdpbk1lZGlhRWxlbWVudC5lbmRlZCA9IHRydWU7XG5cdFx0XHRcdG1lanMuWW91VHViZUFwaS5jcmVhdGVFdmVudChwbGF5ZXIsIHBsdWdpbk1lZGlhRWxlbWVudCwgJ2VuZGVkJyk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHRwbHVnaW5NZWRpYUVsZW1lbnQucGF1c2VkID0gZmFsc2U7XG5cdFx0XHRcdHBsdWdpbk1lZGlhRWxlbWVudC5lbmRlZCA9IGZhbHNlO1x0XHRcdFx0XG5cdFx0XHRcdG1lanMuWW91VHViZUFwaS5jcmVhdGVFdmVudChwbGF5ZXIsIHBsdWdpbk1lZGlhRWxlbWVudCwgJ3BsYXknKTtcblx0XHRcdFx0bWVqcy5Zb3VUdWJlQXBpLmNyZWF0ZUV2ZW50KHBsYXllciwgcGx1Z2luTWVkaWFFbGVtZW50LCAncGxheWluZycpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgMjpcblx0XHRcdFx0cGx1Z2luTWVkaWFFbGVtZW50LnBhdXNlZCA9IHRydWU7XG5cdFx0XHRcdHBsdWdpbk1lZGlhRWxlbWVudC5lbmRlZCA9IGZhbHNlO1x0XHRcdFx0XG5cdFx0XHRcdG1lanMuWW91VHViZUFwaS5jcmVhdGVFdmVudChwbGF5ZXIsIHBsdWdpbk1lZGlhRWxlbWVudCwgJ3BhdXNlJyk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAzOiAvLyBidWZmZXJpbmdcblx0XHRcdFx0bWVqcy5Zb3VUdWJlQXBpLmNyZWF0ZUV2ZW50KHBsYXllciwgcGx1Z2luTWVkaWFFbGVtZW50LCAncHJvZ3Jlc3MnKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIDU6XG5cdFx0XHRcdC8vIGN1ZWQ/XG5cdFx0XHRcdGJyZWFrO1x0XHRcdFx0XHRcdFxuXHRcdFx0XG5cdFx0fVx0XHRcdFxuXHRcdFxuXHR9XG59XG4vLyBJRlJBTUVcbmZ1bmN0aW9uIG9uWW91VHViZVBsYXllckFQSVJlYWR5KCkge1xuXHRtZWpzLllvdVR1YmVBcGkuaUZyYW1lUmVhZHkoKTtcbn1cbi8vIEZMQVNIXG5mdW5jdGlvbiBvbllvdVR1YmVQbGF5ZXJSZWFkeShpZCkge1xuXHRtZWpzLllvdVR1YmVBcGkuZmxhc2hSZWFkeShpZCk7XG59XG5cbndpbmRvdy5tZWpzID0gbWVqcztcbndpbmRvdy5NZWRpYUVsZW1lbnQgPSBtZWpzLk1lZGlhRWxlbWVudDtcblxuLypcbiAqIEFkZHMgSW50ZXJuYXRpb25hbGl6YXRpb24gYW5kIGxvY2FsaXphdGlvbiB0byBtZWRpYWVsZW1lbnQuXG4gKlxuICogVGhpcyBmaWxlIGRvZXMgbm90IGNvbnRhaW4gdHJhbnNsYXRpb25zLCB5b3UgaGF2ZSB0byBhZGQgdGhlbSBtYW51YWxseS5cbiAqIFRoZSBzY2hlbWEgaXMgYWx3YXlzIHRoZSBzYW1lOiBtZS1pMThuLWxvY2FsZS1bSUVURi1sYW5ndWFnZS10YWddLmpzXG4gKlxuICogRXhhbXBsZXMgYXJlIHByb3ZpZGVkIGJvdGggZm9yIGdlcm1hbiBhbmQgY2hpbmVzZSB0cmFuc2xhdGlvbi5cbiAqXG4gKlxuICogV2hhdCBpcyB0aGUgY29uY2VwdCBiZXlvbmQgaTE4bj9cbiAqICAgaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9JbnRlcm5hdGlvbmFsaXphdGlvbl9hbmRfbG9jYWxpemF0aW9uXG4gKlxuICogV2hhdCBsYW5nY29kZSBzaG91bGQgaSB1c2U/XG4gKiAgIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSUVURl9sYW5ndWFnZV90YWdcbiAqICAgaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzU2NDZcbiAqXG4gKlxuICogTGljZW5zZT9cbiAqXG4gKiAgIFRoZSBpMThuIGZpbGUgdXNlcyBtZXRob2RzIGZyb20gdGhlIERydXBhbCBwcm9qZWN0IChkcnVwYWwuanMpOlxuICogICAgIC0gaTE4bi5tZXRob2RzLnQoKSAobW9kaWZpZWQpXG4gKiAgICAgLSBpMThuLm1ldGhvZHMuY2hlY2tQbGFpbigpIChmdWxsIGNvcHkpXG4gKlxuICogICBUaGUgRHJ1cGFsIHByb2plY3QgaXMgKGxpa2UgbWVkaWFlbGVtZW50anMpIGxpY2Vuc2VkIHVuZGVyIEdQTHYyLlxuICogICAgLSBodHRwOi8vZHJ1cGFsLm9yZy9saWNlbnNpbmcvZmFxLyNxMVxuICogICAgLSBodHRwczovL2dpdGh1Yi5jb20vam9obmR5ZXIvbWVkaWFlbGVtZW50XG4gKiAgICAtIGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy9vbGQtbGljZW5zZXMvZ3BsLTIuMC5odG1sXG4gKlxuICpcbiAqIEBhdXRob3JcbiAqICAgVGltIExhdHogKGxhdHoudGltQGdtYWlsLmNvbSlcbiAqXG4gKlxuICogQHBhcmFtc1xuICogIC0gY29udGV4dCAtIGRvY3VtZW50LCBpZnJhbWUgLi5cbiAqICAtIGV4cG9ydHMgLSBDb21tb25KUywgd2luZG93IC4uXG4gKlxuICovXG47KGZ1bmN0aW9uKGNvbnRleHQsIGV4cG9ydHMsIHVuZGVmaW5lZCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgdmFyIGkxOG4gPSB7XG4gICAgICAgIFwibG9jYWxlXCI6IHtcbiAgICAgICAgICAgIC8vIEVuc3VyZSBwcmV2aW91cyB2YWx1ZXMgYXJlbid0IG92ZXJ3cml0dGVuLlxuICAgICAgICAgICAgXCJsYW5ndWFnZVwiIDogKGV4cG9ydHMuaTE4biAmJiBleHBvcnRzLmkxOG4ubG9jYWxlLmxhbmd1YWdlKSB8fCAnJyxcbiAgICAgICAgICAgIFwic3RyaW5nc1wiIDogKGV4cG9ydHMuaTE4biAmJiBleHBvcnRzLmkxOG4ubG9jYWxlLnN0cmluZ3MpIHx8IHt9XG4gICAgICAgIH0sXG4gICAgICAgIFwiaWV0Zl9sYW5nX3JlZ2V4XCIgOiAvXih4XFwtKT9bYS16XXsyLH0oXFwtXFx3ezIsfSk/KFxcLVxcd3syLH0pPyQvLFxuICAgICAgICBcIm1ldGhvZHNcIiA6IHt9XG4gICAgfTtcbi8vIHN0YXJ0IGkxOG5cblxuXG4gICAgLyoqXG4gICAgICogR2V0IGxhbmd1YWdlLCBmYWxsYmFjayB0byBicm93c2VyJ3MgbGFuZ3VhZ2UgaWYgZW1wdHlcbiAgICAgKlxuICAgICAqIElFVEY6IFJGQyA1NjQ2LCBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjNTY0NlxuICAgICAqIEV4YW1wbGVzOiBlbiwgemgtQ04sIGNtbi1IYW5zLUNOLCBzci1MYXRuLVJTLCBlcy00MTksIHgtcHJpdmF0ZVxuICAgICAqL1xuICAgIGkxOG4uZ2V0TGFuZ3VhZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBsYW5ndWFnZSA9IGkxOG4ubG9jYWxlLmxhbmd1YWdlIHx8IHdpbmRvdy5uYXZpZ2F0b3IudXNlckxhbmd1YWdlIHx8IHdpbmRvdy5uYXZpZ2F0b3IubGFuZ3VhZ2U7XG4gICAgICAgIHJldHVybiBpMThuLmlldGZfbGFuZ19yZWdleC5leGVjKGxhbmd1YWdlKSA/IGxhbmd1YWdlIDogbnVsbDtcblxuICAgICAgICAvLyhXQVM6IGNvbnZlcnQgdG8gaXNvIDYzOS0xICgyLWxldHRlcnMsIGxvd2VyIGNhc2UpKVxuICAgICAgICAvL3JldHVybiBsYW5ndWFnZS5zdWJzdHIoMCwgMikudG9Mb3dlckNhc2UoKTtcbiAgICB9O1xuXG4gICAgLy8gaTE4biBmaXhlcyBmb3IgY29tcGF0aWJpbGl0eSB3aXRoIFdvcmRQcmVzc1xuICAgIGlmICggdHlwZW9mIG1lanNMMTBuICE9ICd1bmRlZmluZWQnICkge1xuICAgICAgICBpMThuLmxvY2FsZS5sYW5ndWFnZSA9IG1lanNMMTBuLmxhbmd1YWdlO1xuICAgIH1cblxuXG5cbiAgICAvKipcbiAgICAgKiBFbmNvZGUgc3BlY2lhbCBjaGFyYWN0ZXJzIGluIGEgcGxhaW4tdGV4dCBzdHJpbmcgZm9yIGRpc3BsYXkgYXMgSFRNTC5cbiAgICAgKi9cbiAgICBpMThuLm1ldGhvZHMuY2hlY2tQbGFpbiA9IGZ1bmN0aW9uIChzdHIpIHtcbiAgICAgICAgdmFyIGNoYXJhY3RlciwgcmVnZXgsXG4gICAgICAgIHJlcGxhY2UgPSB7XG4gICAgICAgICAgICAnJic6ICcmYW1wOycsXG4gICAgICAgICAgICAnXCInOiAnJnF1b3Q7JyxcbiAgICAgICAgICAgICc8JzogJyZsdDsnLFxuICAgICAgICAgICAgJz4nOiAnJmd0OydcbiAgICAgICAgfTtcbiAgICAgICAgc3RyID0gU3RyaW5nKHN0cik7XG4gICAgICAgIGZvciAoY2hhcmFjdGVyIGluIHJlcGxhY2UpIHtcbiAgICAgICAgICAgIGlmIChyZXBsYWNlLmhhc093blByb3BlcnR5KGNoYXJhY3RlcikpIHtcbiAgICAgICAgICAgICAgICByZWdleCA9IG5ldyBSZWdFeHAoY2hhcmFjdGVyLCAnZycpO1xuICAgICAgICAgICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKHJlZ2V4LCByZXBsYWNlW2NoYXJhY3Rlcl0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzdHI7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFRyYW5zbGF0ZSBzdHJpbmdzIHRvIHRoZSBwYWdlIGxhbmd1YWdlIG9yIGEgZ2l2ZW4gbGFuZ3VhZ2UuXG4gICAgICpcbiAgICAgKlxuICAgICAqIEBwYXJhbSBzdHJcbiAgICAgKiAgIEEgc3RyaW5nIGNvbnRhaW5pbmcgdGhlIEVuZ2xpc2ggc3RyaW5nIHRvIHRyYW5zbGF0ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBvcHRpb25zXG4gICAgICogICAtICdjb250ZXh0JyAoZGVmYXVsdHMgdG8gdGhlIGRlZmF1bHQgY29udGV4dCk6IFRoZSBjb250ZXh0IHRoZSBzb3VyY2Ugc3RyaW5nXG4gICAgICogICAgIGJlbG9uZ3MgdG8uXG4gICAgICpcbiAgICAgKiBAcmV0dXJuXG4gICAgICogICBUaGUgdHJhbnNsYXRlZCBzdHJpbmcsIGVzY2FwZWQgdmlhIGkxOG4ubWV0aG9kcy5jaGVja1BsYWluKClcbiAgICAgKi9cbiAgICBpMThuLm1ldGhvZHMudCA9IGZ1bmN0aW9uIChzdHIsIG9wdGlvbnMpIHtcblxuICAgICAgICAvLyBGZXRjaCB0aGUgbG9jYWxpemVkIHZlcnNpb24gb2YgdGhlIHN0cmluZy5cbiAgICAgICAgaWYgKGkxOG4ubG9jYWxlLnN0cmluZ3MgJiYgaTE4bi5sb2NhbGUuc3RyaW5nc1tvcHRpb25zLmNvbnRleHRdICYmIGkxOG4ubG9jYWxlLnN0cmluZ3Nbb3B0aW9ucy5jb250ZXh0XVtzdHJdKSB7XG4gICAgICAgICAgICBzdHIgPSBpMThuLmxvY2FsZS5zdHJpbmdzW29wdGlvbnMuY29udGV4dF1bc3RyXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBpMThuLm1ldGhvZHMuY2hlY2tQbGFpbihzdHIpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIFdyYXBwZXIgZm9yIGkxOG4ubWV0aG9kcy50KClcbiAgICAgKlxuICAgICAqIEBzZWUgaTE4bi5tZXRob2RzLnQoKVxuICAgICAqIEB0aHJvd3MgSW52YWxpZEFyZ3VtZW50RXhjZXB0aW9uXG4gICAgICovXG4gICAgaTE4bi50ID0gZnVuY3Rpb24oc3RyLCBvcHRpb25zKSB7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBzdHIgPT09ICdzdHJpbmcnICYmIHN0ci5sZW5ndGggPiAwKSB7XG5cbiAgICAgICAgICAgIC8vIGNoZWNrIGV2ZXJ5IHRpbWUgZHVlIGxhbmd1YWdlIGNhbiBjaGFuZ2UgZm9yXG4gICAgICAgICAgICAvLyBkaWZmZXJlbnQgcmVhc29ucyAodHJhbnNsYXRpb24sIGxhbmcgc3dpdGNoZXIgLi4pXG4gICAgICAgICAgICB2YXIgbGFuZ3VhZ2UgPSBpMThuLmdldExhbmd1YWdlKCk7XG5cbiAgICAgICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHtcbiAgICAgICAgICAgICAgICBcImNvbnRleHRcIiA6IGxhbmd1YWdlXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICByZXR1cm4gaTE4bi5tZXRob2RzLnQoc3RyLCBvcHRpb25zKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IHtcbiAgICAgICAgICAgICAgICBcIm5hbWVcIiA6ICdJbnZhbGlkQXJndW1lbnRFeGNlcHRpb24nLFxuICAgICAgICAgICAgICAgIFwibWVzc2FnZVwiIDogJ0ZpcnN0IGFyZ3VtZW50IGlzIGVpdGhlciBub3QgYSBzdHJpbmcgb3IgZW1wdHkuJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH07XG5cbi8vIGVuZCBpMThuXG4gICAgZXhwb3J0cy5pMThuID0gaTE4bjtcbn0oZG9jdW1lbnQsIG1lanMpKTtcblxuLy8gaTE4biBmaXhlcyBmb3IgY29tcGF0aWJpbGl0eSB3aXRoIFdvcmRQcmVzc1xuOyhmdW5jdGlvbihleHBvcnRzLCB1bmRlZmluZWQpIHtcblxuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgaWYgKCB0eXBlb2YgbWVqc0wxMG4gIT0gJ3VuZGVmaW5lZCcgKSB7XG4gICAgICAgIGV4cG9ydHNbbWVqc0wxMG4ubGFuZ3VhZ2VdID0gbWVqc0wxMG4uc3RyaW5ncztcbiAgICB9XG5cbn0obWVqcy5pMThuLmxvY2FsZS5zdHJpbmdzKSk7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvLi4vLi4vYm93ZXJfY29tcG9uZW50cy9tZWRpYWVsZW1lbnQvYnVpbGQvbWVkaWFlbGVtZW50LmpzXCIsXCIvLi4vLi4vYm93ZXJfY29tcG9uZW50cy9tZWRpYWVsZW1lbnQvYnVpbGRcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4vKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyXG5cbi8qKlxuICogSWYgYEJ1ZmZlci5fdXNlVHlwZWRBcnJheXNgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgVXNlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiAoY29tcGF0aWJsZSBkb3duIHRvIElFNilcbiAqL1xuQnVmZmVyLl91c2VUeXBlZEFycmF5cyA9IChmdW5jdGlvbiAoKSB7XG4gIC8vIERldGVjdCBpZiBicm93c2VyIHN1cHBvcnRzIFR5cGVkIEFycmF5cy4gU3VwcG9ydGVkIGJyb3dzZXJzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssXG4gIC8vIENocm9tZSA3KywgU2FmYXJpIDUuMSssIE9wZXJhIDExLjYrLCBpT1MgNC4yKy4gSWYgdGhlIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCBhZGRpbmdcbiAgLy8gcHJvcGVydGllcyB0byBgVWludDhBcnJheWAgaW5zdGFuY2VzLCB0aGVuIHRoYXQncyB0aGUgc2FtZSBhcyBubyBgVWludDhBcnJheWAgc3VwcG9ydFxuICAvLyBiZWNhdXNlIHdlIG5lZWQgdG8gYmUgYWJsZSB0byBhZGQgYWxsIHRoZSBub2RlIEJ1ZmZlciBBUEkgbWV0aG9kcy4gVGhpcyBpcyBhbiBpc3N1ZVxuICAvLyBpbiBGaXJlZm94IDQtMjkuIE5vdyBmaXhlZDogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4XG4gIHRyeSB7XG4gICAgdmFyIGJ1ZiA9IG5ldyBBcnJheUJ1ZmZlcigwKVxuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheShidWYpXG4gICAgYXJyLmZvbyA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH1cbiAgICByZXR1cm4gNDIgPT09IGFyci5mb28oKSAmJlxuICAgICAgICB0eXBlb2YgYXJyLnN1YmFycmF5ID09PSAnZnVuY3Rpb24nIC8vIENocm9tZSA5LTEwIGxhY2sgYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn0pKClcblxuLyoqXG4gKiBDbGFzczogQnVmZmVyXG4gKiA9PT09PT09PT09PT09XG4gKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBhcmUgYXVnbWVudGVkXG4gKiB3aXRoIGZ1bmN0aW9uIHByb3BlcnRpZXMgZm9yIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBBUEkgZnVuY3Rpb25zLiBXZSB1c2VcbiAqIGBVaW50OEFycmF5YCBzbyB0aGF0IHNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0IHJldHVybnNcbiAqIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIEJ5IGF1Z21lbnRpbmcgdGhlIGluc3RhbmNlcywgd2UgY2FuIGF2b2lkIG1vZGlmeWluZyB0aGUgYFVpbnQ4QXJyYXlgXG4gKiBwcm90b3R5cGUuXG4gKi9cbmZ1bmN0aW9uIEJ1ZmZlciAoc3ViamVjdCwgZW5jb2RpbmcsIG5vWmVybykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSlcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihzdWJqZWN0LCBlbmNvZGluZywgbm9aZXJvKVxuXG4gIHZhciB0eXBlID0gdHlwZW9mIHN1YmplY3RcblxuICAvLyBXb3JrYXJvdW5kOiBub2RlJ3MgYmFzZTY0IGltcGxlbWVudGF0aW9uIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBzdHJpbmdzXG4gIC8vIHdoaWxlIGJhc2U2NC1qcyBkb2VzIG5vdC5cbiAgaWYgKGVuY29kaW5nID09PSAnYmFzZTY0JyAmJiB0eXBlID09PSAnc3RyaW5nJykge1xuICAgIHN1YmplY3QgPSBzdHJpbmd0cmltKHN1YmplY3QpXG4gICAgd2hpbGUgKHN1YmplY3QubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgICAgc3ViamVjdCA9IHN1YmplY3QgKyAnPSdcbiAgICB9XG4gIH1cblxuICAvLyBGaW5kIHRoZSBsZW5ndGhcbiAgdmFyIGxlbmd0aFxuICBpZiAodHlwZSA9PT0gJ251bWJlcicpXG4gICAgbGVuZ3RoID0gY29lcmNlKHN1YmplY3QpXG4gIGVsc2UgaWYgKHR5cGUgPT09ICdzdHJpbmcnKVxuICAgIGxlbmd0aCA9IEJ1ZmZlci5ieXRlTGVuZ3RoKHN1YmplY3QsIGVuY29kaW5nKVxuICBlbHNlIGlmICh0eXBlID09PSAnb2JqZWN0JylcbiAgICBsZW5ndGggPSBjb2VyY2Uoc3ViamVjdC5sZW5ndGgpIC8vIGFzc3VtZSB0aGF0IG9iamVjdCBpcyBhcnJheS1saWtlXG4gIGVsc2VcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZpcnN0IGFyZ3VtZW50IG5lZWRzIHRvIGJlIGEgbnVtYmVyLCBhcnJheSBvciBzdHJpbmcuJylcblxuICB2YXIgYnVmXG4gIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgLy8gUHJlZmVycmVkOiBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIGJ1ZiA9IEJ1ZmZlci5fYXVnbWVudChuZXcgVWludDhBcnJheShsZW5ndGgpKVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gVEhJUyBpbnN0YW5jZSBvZiBCdWZmZXIgKGNyZWF0ZWQgYnkgYG5ld2ApXG4gICAgYnVmID0gdGhpc1xuICAgIGJ1Zi5sZW5ndGggPSBsZW5ndGhcbiAgICBidWYuX2lzQnVmZmVyID0gdHJ1ZVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMgJiYgdHlwZW9mIHN1YmplY3QuYnl0ZUxlbmd0aCA9PT0gJ251bWJlcicpIHtcbiAgICAvLyBTcGVlZCBvcHRpbWl6YXRpb24gLS0gdXNlIHNldCBpZiB3ZSdyZSBjb3B5aW5nIGZyb20gYSB0eXBlZCBhcnJheVxuICAgIGJ1Zi5fc2V0KHN1YmplY3QpXG4gIH0gZWxzZSBpZiAoaXNBcnJheWlzaChzdWJqZWN0KSkge1xuICAgIC8vIFRyZWF0IGFycmF5LWlzaCBvYmplY3RzIGFzIGEgYnl0ZSBhcnJheVxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSlcbiAgICAgICAgYnVmW2ldID0gc3ViamVjdC5yZWFkVUludDgoaSlcbiAgICAgIGVsc2VcbiAgICAgICAgYnVmW2ldID0gc3ViamVjdFtpXVxuICAgIH1cbiAgfSBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJykge1xuICAgIGJ1Zi53cml0ZShzdWJqZWN0LCAwLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnbnVtYmVyJyAmJiAhQnVmZmVyLl91c2VUeXBlZEFycmF5cyAmJiAhbm9aZXJvKSB7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBidWZbaV0gPSAwXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ1ZlxufVxuXG4vLyBTVEFUSUMgTUVUSE9EU1xuLy8gPT09PT09PT09PT09PT1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIChiKSB7XG4gIHJldHVybiAhIShiICE9PSBudWxsICYmIGIgIT09IHVuZGVmaW5lZCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmJ5dGVMZW5ndGggPSBmdW5jdGlvbiAoc3RyLCBlbmNvZGluZykge1xuICB2YXIgcmV0XG4gIHN0ciA9IHN0ciArICcnXG4gIHN3aXRjaCAoZW5jb2RpbmcgfHwgJ3V0ZjgnKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGggLyAyXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IHV0ZjhUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBiYXNlNjRUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoICogMlxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGVuY29kaW5nJylcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiAobGlzdCwgdG90YWxMZW5ndGgpIHtcbiAgYXNzZXJ0KGlzQXJyYXkobGlzdCksICdVc2FnZTogQnVmZmVyLmNvbmNhdChsaXN0LCBbdG90YWxMZW5ndGhdKVxcbicgK1xuICAgICAgJ2xpc3Qgc2hvdWxkIGJlIGFuIEFycmF5LicpXG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoMClcbiAgfSBlbHNlIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBsaXN0WzBdXG4gIH1cblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHRvdGFsTGVuZ3RoICE9PSAnbnVtYmVyJykge1xuICAgIHRvdGFsTGVuZ3RoID0gMFxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB0b3RhbExlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKHRvdGFsTGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gbGlzdFtpXVxuICAgIGl0ZW0uY29weShidWYsIHBvcylcbiAgICBwb3MgKz0gaXRlbS5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbi8vIEJVRkZFUiBJTlNUQU5DRSBNRVRIT0RTXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBfaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICAvLyBtdXN0IGJlIGFuIGV2ZW4gbnVtYmVyIG9mIGRpZ2l0c1xuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuICBhc3NlcnQoc3RyTGVuICUgMiA9PT0gMCwgJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBieXRlID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGFzc2VydCghaXNOYU4oYnl0ZSksICdJbnZhbGlkIGhleCBzdHJpbmcnKVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IGJ5dGVcbiAgfVxuICBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9IGkgKiAyXG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIF91dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBfYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9XG4gICAgYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBfYmluYXJ5V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gX2FzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBfYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIF91dGYxNmxlV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIFN1cHBvcnQgYm90aCAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpXG4gIC8vIGFuZCB0aGUgbGVnYWN5IChzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBpZiAoIWlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIH0gZWxzZSB7ICAvLyBsZWdhY3lcbiAgICB2YXIgc3dhcCA9IGVuY29kaW5nXG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBvZmZzZXQgPSBsZW5ndGhcbiAgICBsZW5ndGggPSBzd2FwXG4gIH1cblxuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG4gIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKVxuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBfaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gX3V0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgICByZXQgPSBfYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gX2JpbmFyeVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBfYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IF91dGYxNmxlV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKVxuICBzdGFydCA9IE51bWJlcihzdGFydCkgfHwgMFxuICBlbmQgPSAoZW5kICE9PSB1bmRlZmluZWQpXG4gICAgPyBOdW1iZXIoZW5kKVxuICAgIDogZW5kID0gc2VsZi5sZW5ndGhcblxuICAvLyBGYXN0cGF0aCBlbXB0eSBzdHJpbmdzXG4gIGlmIChlbmQgPT09IHN0YXJ0KVxuICAgIHJldHVybiAnJ1xuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBfaGV4U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gX3V0ZjhTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgICByZXQgPSBfYXNjaWlTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gX2JpbmFyeVNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBfYmFzZTY0U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IF91dGYxNmxlU2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiAodGFyZ2V0LCB0YXJnZXRfc3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHNvdXJjZSA9IHRoaXNcblxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAoIXRhcmdldF9zdGFydCkgdGFyZ2V0X3N0YXJ0ID0gMFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHNvdXJjZS5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgYXNzZXJ0KGVuZCA+PSBzdGFydCwgJ3NvdXJjZUVuZCA8IHNvdXJjZVN0YXJ0JylcbiAgYXNzZXJ0KHRhcmdldF9zdGFydCA+PSAwICYmIHRhcmdldF9zdGFydCA8IHRhcmdldC5sZW5ndGgsXG4gICAgICAndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGFzc2VydChzdGFydCA+PSAwICYmIHN0YXJ0IDwgc291cmNlLmxlbmd0aCwgJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoZW5kID49IDAgJiYgZW5kIDw9IHNvdXJjZS5sZW5ndGgsICdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKVxuICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0X3N0YXJ0IDwgZW5kIC0gc3RhcnQpXG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldF9zdGFydCArIHN0YXJ0XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG5cbiAgaWYgKGxlbiA8IDEwMCB8fCAhQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICB0YXJnZXRbaSArIHRhcmdldF9zdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgfSBlbHNlIHtcbiAgICB0YXJnZXQuX3NldCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksIHRhcmdldF9zdGFydClcbiAgfVxufVxuXG5mdW5jdGlvbiBfYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIF91dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmVzID0gJydcbiAgdmFyIHRtcCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIGlmIChidWZbaV0gPD0gMHg3Rikge1xuICAgICAgcmVzICs9IGRlY29kZVV0ZjhDaGFyKHRtcCkgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgICAgIHRtcCA9ICcnXG4gICAgfSBlbHNlIHtcbiAgICAgIHRtcCArPSAnJScgKyBidWZbaV0udG9TdHJpbmcoMTYpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlcyArIGRlY29kZVV0ZjhDaGFyKHRtcClcbn1cblxuZnVuY3Rpb24gX2FzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKVxuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBfYmluYXJ5U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICByZXR1cm4gX2FzY2lpU2xpY2UoYnVmLCBzdGFydCwgZW5kKVxufVxuXG5mdW5jdGlvbiBfaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiBfdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyBieXRlc1tpKzFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IGNsYW1wKHN0YXJ0LCBsZW4sIDApXG4gIGVuZCA9IGNsYW1wKGVuZCwgbGVuLCBsZW4pXG5cbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMpIHtcbiAgICByZXR1cm4gQnVmZmVyLl9hdWdtZW50KHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZCkpXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICB2YXIgbmV3QnVmID0gbmV3IEJ1ZmZlcihzbGljZUxlbiwgdW5kZWZpbmVkLCB0cnVlKVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2xpY2VMZW47IGkrKykge1xuICAgICAgbmV3QnVmW2ldID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICAgIHJldHVybiBuZXdCdWZcbiAgfVxufVxuXG4vLyBgZ2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuZ2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy5yZWFkVUludDgob2Zmc2V0KVxufVxuXG4vLyBgc2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAodiwgb2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuc2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy53cml0ZVVJbnQ4KHYsIG9mZnNldClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuZnVuY3Rpb24gX3JlYWRVSW50MTYgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsXG4gIGlmIChsaXR0bGVFbmRpYW4pIHtcbiAgICB2YWwgPSBidWZbb2Zmc2V0XVxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXSA8PCA4XG4gIH0gZWxzZSB7XG4gICAgdmFsID0gYnVmW29mZnNldF0gPDwgOFxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXVxuICB9XG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MTYodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MTYodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF9yZWFkVUludDMyIChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbFxuICBpZiAobGl0dGxlRW5kaWFuKSB7XG4gICAgaWYgKG9mZnNldCArIDIgPCBsZW4pXG4gICAgICB2YWwgPSBidWZbb2Zmc2V0ICsgMl0gPDwgMTZcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMV0gPDwgOFxuICAgIHZhbCB8PSBidWZbb2Zmc2V0XVxuICAgIGlmIChvZmZzZXQgKyAzIDwgbGVuKVxuICAgICAgdmFsID0gdmFsICsgKGJ1ZltvZmZzZXQgKyAzXSA8PCAyNCA+Pj4gMClcbiAgfSBlbHNlIHtcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCA9IGJ1ZltvZmZzZXQgKyAxXSA8PCAxNlxuICAgIGlmIChvZmZzZXQgKyAyIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAyXSA8PCA4XG4gICAgaWYgKG9mZnNldCArIDMgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDNdXG4gICAgdmFsID0gdmFsICsgKGJ1ZltvZmZzZXRdIDw8IDI0ID4+PiAwKVxuICB9XG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MzIodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MzIodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCxcbiAgICAgICAgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIHZhciBuZWcgPSB0aGlzW29mZnNldF0gJiAweDgwXG4gIGlmIChuZWcpXG4gICAgcmV0dXJuICgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMVxuICBlbHNlXG4gICAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5mdW5jdGlvbiBfcmVhZEludDE2IChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbCA9IF9yZWFkVUludDE2KGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIHRydWUpXG4gIHZhciBuZWcgPSB2YWwgJiAweDgwMDBcbiAgaWYgKG5lZylcbiAgICByZXR1cm4gKDB4ZmZmZiAtIHZhbCArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDE2KHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQxNih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWRJbnQzMiAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIHZhciB2YWwgPSBfcmVhZFVJbnQzMihidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCB0cnVlKVxuICB2YXIgbmVnID0gdmFsICYgMHg4MDAwMDAwMFxuICBpZiAobmVnKVxuICAgIHJldHVybiAoMHhmZmZmZmZmZiAtIHZhbCArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDMyKHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQzMih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWRGbG9hdCAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICByZXR1cm4gaWVlZTc1NC5yZWFkKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkRmxvYXQodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEZsb2F0KHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfcmVhZERvdWJsZSAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICsgNyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICByZXR1cm4gaWVlZTc1NC5yZWFkKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZERvdWJsZSh0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZERvdWJsZSh0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAndHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnVpbnQodmFsdWUsIDB4ZmYpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKSByZXR1cm5cblxuICB0aGlzW29mZnNldF0gPSB2YWx1ZVxufVxuXG5mdW5jdGlvbiBfd3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZmZmKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihsZW4gLSBvZmZzZXQsIDIpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID1cbiAgICAgICAgKHZhbHVlICYgKDB4ZmYgPDwgKDggKiAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSkpKSA+Pj5cbiAgICAgICAgICAgIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpICogOFxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZmZmZmZmZilcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4obGVuIC0gb2Zmc2V0LCA0KTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9XG4gICAgICAgICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmc2ludCh2YWx1ZSwgMHg3ZiwgLTB4ODApXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIGlmICh2YWx1ZSA+PSAwKVxuICAgIHRoaXMud3JpdGVVSW50OCh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydClcbiAgZWxzZVxuICAgIHRoaXMud3JpdGVVSW50OCgweGZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAxIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZzaW50KHZhbHVlLCAweDdmZmYsIC0weDgwMDApXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZiAodmFsdWUgPj0gMClcbiAgICBfd3JpdGVVSW50MTYoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KVxuICBlbHNlXG4gICAgX3dyaXRlVUludDE2KGJ1ZiwgMHhmZmZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF93cml0ZUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnNpbnQodmFsdWUsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWYgKHZhbHVlID49IDApXG4gICAgX3dyaXRlVUludDMyKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbiAgZWxzZVxuICAgIF93cml0ZVVJbnQzMihidWYsIDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDEsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlRmxvYXQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmSUVFRTc1NCh2YWx1ZSwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdEJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlRG91YmxlIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDcgPCBidWYubGVuZ3RoLFxuICAgICAgICAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZklFRUU3NTQodmFsdWUsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGZpbGwodmFsdWUsIHN0YXJ0PTAsIGVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gKHZhbHVlLCBzdGFydCwgZW5kKSB7XG4gIGlmICghdmFsdWUpIHZhbHVlID0gMFxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQpIGVuZCA9IHRoaXMubGVuZ3RoXG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICB2YWx1ZSA9IHZhbHVlLmNoYXJDb2RlQXQoMClcbiAgfVxuXG4gIGFzc2VydCh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmICFpc05hTih2YWx1ZSksICd2YWx1ZSBpcyBub3QgYSBudW1iZXInKVxuICBhc3NlcnQoZW5kID49IHN0YXJ0LCAnZW5kIDwgc3RhcnQnKVxuXG4gIC8vIEZpbGwgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgYXNzZXJ0KHN0YXJ0ID49IDAgJiYgc3RhcnQgPCB0aGlzLmxlbmd0aCwgJ3N0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoZW5kID49IDAgJiYgZW5kIDw9IHRoaXMubGVuZ3RoLCAnZW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgdGhpc1tpXSA9IHZhbHVlXG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgb3V0ID0gW11cbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICBvdXRbaV0gPSB0b0hleCh0aGlzW2ldKVxuICAgIGlmIChpID09PSBleHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTKSB7XG4gICAgICBvdXRbaSArIDFdID0gJy4uLidcbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgb3V0LmpvaW4oJyAnKSArICc+J1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgYEFycmF5QnVmZmVyYCB3aXRoIHRoZSAqY29waWVkKiBtZW1vcnkgb2YgdGhlIGJ1ZmZlciBpbnN0YW5jZS5cbiAqIEFkZGVkIGluIE5vZGUgMC4xMi4gT25seSBhdmFpbGFibGUgaW4gYnJvd3NlcnMgdGhhdCBzdXBwb3J0IEFycmF5QnVmZmVyLlxuICovXG5CdWZmZXIucHJvdG90eXBlLnRvQXJyYXlCdWZmZXIgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgICAgcmV0dXJuIChuZXcgQnVmZmVyKHRoaXMpKS5idWZmZXJcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGJ1ZiA9IG5ldyBVaW50OEFycmF5KHRoaXMubGVuZ3RoKVxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGJ1Zi5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSlcbiAgICAgICAgYnVmW2ldID0gdGhpc1tpXVxuICAgICAgcmV0dXJuIGJ1Zi5idWZmZXJcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdCdWZmZXIudG9BcnJheUJ1ZmZlciBub3Qgc3VwcG9ydGVkIGluIHRoaXMgYnJvd3NlcicpXG4gIH1cbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBzdHJpbmd0cmltIChzdHIpIHtcbiAgaWYgKHN0ci50cmltKSByZXR1cm4gc3RyLnRyaW0oKVxuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxufVxuXG52YXIgQlAgPSBCdWZmZXIucHJvdG90eXBlXG5cbi8qKlxuICogQXVnbWVudCBhIFVpbnQ4QXJyYXkgKmluc3RhbmNlKiAobm90IHRoZSBVaW50OEFycmF5IGNsYXNzISkgd2l0aCBCdWZmZXIgbWV0aG9kc1xuICovXG5CdWZmZXIuX2F1Z21lbnQgPSBmdW5jdGlvbiAoYXJyKSB7XG4gIGFyci5faXNCdWZmZXIgPSB0cnVlXG5cbiAgLy8gc2F2ZSByZWZlcmVuY2UgdG8gb3JpZ2luYWwgVWludDhBcnJheSBnZXQvc2V0IG1ldGhvZHMgYmVmb3JlIG92ZXJ3cml0aW5nXG4gIGFyci5fZ2V0ID0gYXJyLmdldFxuICBhcnIuX3NldCA9IGFyci5zZXRcblxuICAvLyBkZXByZWNhdGVkLCB3aWxsIGJlIHJlbW92ZWQgaW4gbm9kZSAwLjEzK1xuICBhcnIuZ2V0ID0gQlAuZ2V0XG4gIGFyci5zZXQgPSBCUC5zZXRcblxuICBhcnIud3JpdGUgPSBCUC53cml0ZVxuICBhcnIudG9TdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9Mb2NhbGVTdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9KU09OID0gQlAudG9KU09OXG4gIGFyci5jb3B5ID0gQlAuY29weVxuICBhcnIuc2xpY2UgPSBCUC5zbGljZVxuICBhcnIucmVhZFVJbnQ4ID0gQlAucmVhZFVJbnQ4XG4gIGFyci5yZWFkVUludDE2TEUgPSBCUC5yZWFkVUludDE2TEVcbiAgYXJyLnJlYWRVSW50MTZCRSA9IEJQLnJlYWRVSW50MTZCRVxuICBhcnIucmVhZFVJbnQzMkxFID0gQlAucmVhZFVJbnQzMkxFXG4gIGFyci5yZWFkVUludDMyQkUgPSBCUC5yZWFkVUludDMyQkVcbiAgYXJyLnJlYWRJbnQ4ID0gQlAucmVhZEludDhcbiAgYXJyLnJlYWRJbnQxNkxFID0gQlAucmVhZEludDE2TEVcbiAgYXJyLnJlYWRJbnQxNkJFID0gQlAucmVhZEludDE2QkVcbiAgYXJyLnJlYWRJbnQzMkxFID0gQlAucmVhZEludDMyTEVcbiAgYXJyLnJlYWRJbnQzMkJFID0gQlAucmVhZEludDMyQkVcbiAgYXJyLnJlYWRGbG9hdExFID0gQlAucmVhZEZsb2F0TEVcbiAgYXJyLnJlYWRGbG9hdEJFID0gQlAucmVhZEZsb2F0QkVcbiAgYXJyLnJlYWREb3VibGVMRSA9IEJQLnJlYWREb3VibGVMRVxuICBhcnIucmVhZERvdWJsZUJFID0gQlAucmVhZERvdWJsZUJFXG4gIGFyci53cml0ZVVJbnQ4ID0gQlAud3JpdGVVSW50OFxuICBhcnIud3JpdGVVSW50MTZMRSA9IEJQLndyaXRlVUludDE2TEVcbiAgYXJyLndyaXRlVUludDE2QkUgPSBCUC53cml0ZVVJbnQxNkJFXG4gIGFyci53cml0ZVVJbnQzMkxFID0gQlAud3JpdGVVSW50MzJMRVxuICBhcnIud3JpdGVVSW50MzJCRSA9IEJQLndyaXRlVUludDMyQkVcbiAgYXJyLndyaXRlSW50OCA9IEJQLndyaXRlSW50OFxuICBhcnIud3JpdGVJbnQxNkxFID0gQlAud3JpdGVJbnQxNkxFXG4gIGFyci53cml0ZUludDE2QkUgPSBCUC53cml0ZUludDE2QkVcbiAgYXJyLndyaXRlSW50MzJMRSA9IEJQLndyaXRlSW50MzJMRVxuICBhcnIud3JpdGVJbnQzMkJFID0gQlAud3JpdGVJbnQzMkJFXG4gIGFyci53cml0ZUZsb2F0TEUgPSBCUC53cml0ZUZsb2F0TEVcbiAgYXJyLndyaXRlRmxvYXRCRSA9IEJQLndyaXRlRmxvYXRCRVxuICBhcnIud3JpdGVEb3VibGVMRSA9IEJQLndyaXRlRG91YmxlTEVcbiAgYXJyLndyaXRlRG91YmxlQkUgPSBCUC53cml0ZURvdWJsZUJFXG4gIGFyci5maWxsID0gQlAuZmlsbFxuICBhcnIuaW5zcGVjdCA9IEJQLmluc3BlY3RcbiAgYXJyLnRvQXJyYXlCdWZmZXIgPSBCUC50b0FycmF5QnVmZmVyXG5cbiAgcmV0dXJuIGFyclxufVxuXG4vLyBzbGljZShzdGFydCwgZW5kKVxuZnVuY3Rpb24gY2xhbXAgKGluZGV4LCBsZW4sIGRlZmF1bHRWYWx1ZSkge1xuICBpZiAodHlwZW9mIGluZGV4ICE9PSAnbnVtYmVyJykgcmV0dXJuIGRlZmF1bHRWYWx1ZVxuICBpbmRleCA9IH5+aW5kZXg7ICAvLyBDb2VyY2UgdG8gaW50ZWdlci5cbiAgaWYgKGluZGV4ID49IGxlbikgcmV0dXJuIGxlblxuICBpZiAoaW5kZXggPj0gMCkgcmV0dXJuIGluZGV4XG4gIGluZGV4ICs9IGxlblxuICBpZiAoaW5kZXggPj0gMCkgcmV0dXJuIGluZGV4XG4gIHJldHVybiAwXG59XG5cbmZ1bmN0aW9uIGNvZXJjZSAobGVuZ3RoKSB7XG4gIC8vIENvZXJjZSBsZW5ndGggdG8gYSBudW1iZXIgKHBvc3NpYmx5IE5hTiksIHJvdW5kIHVwXG4gIC8vIGluIGNhc2UgaXQncyBmcmFjdGlvbmFsIChlLmcuIDEyMy40NTYpIHRoZW4gZG8gYVxuICAvLyBkb3VibGUgbmVnYXRlIHRvIGNvZXJjZSBhIE5hTiB0byAwLiBFYXN5LCByaWdodD9cbiAgbGVuZ3RoID0gfn5NYXRoLmNlaWwoK2xlbmd0aClcbiAgcmV0dXJuIGxlbmd0aCA8IDAgPyAwIDogbGVuZ3RoXG59XG5cbmZ1bmN0aW9uIGlzQXJyYXkgKHN1YmplY3QpIHtcbiAgcmV0dXJuIChBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChzdWJqZWN0KSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChzdWJqZWN0KSA9PT0gJ1tvYmplY3QgQXJyYXldJ1xuICB9KShzdWJqZWN0KVxufVxuXG5mdW5jdGlvbiBpc0FycmF5aXNoIChzdWJqZWN0KSB7XG4gIHJldHVybiBpc0FycmF5KHN1YmplY3QpIHx8IEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSB8fFxuICAgICAgc3ViamVjdCAmJiB0eXBlb2Ygc3ViamVjdCA9PT0gJ29iamVjdCcgJiZcbiAgICAgIHR5cGVvZiBzdWJqZWN0Lmxlbmd0aCA9PT0gJ251bWJlcidcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIHZhciBiID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBpZiAoYiA8PSAweDdGKVxuICAgICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkpXG4gICAgZWxzZSB7XG4gICAgICB2YXIgc3RhcnQgPSBpXG4gICAgICBpZiAoYiA+PSAweEQ4MDAgJiYgYiA8PSAweERGRkYpIGkrK1xuICAgICAgdmFyIGggPSBlbmNvZGVVUklDb21wb25lbnQoc3RyLnNsaWNlKHN0YXJ0LCBpKzEpKS5zdWJzdHIoMSkuc3BsaXQoJyUnKVxuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBoLmxlbmd0aDsgaisrKVxuICAgICAgICBieXRlQXJyYXkucHVzaChwYXJzZUludChoW2pdLCAxNikpXG4gICAgfVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KHN0cilcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBwb3NcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSlcbiAgICAgIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gZGVjb2RlVXRmOENoYXIgKHN0cikge1xuICB0cnkge1xuICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoc3RyKVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZSgweEZGRkQpIC8vIFVURiA4IGludmFsaWQgY2hhclxuICB9XG59XG5cbi8qXG4gKiBXZSBoYXZlIHRvIG1ha2Ugc3VyZSB0aGF0IHRoZSB2YWx1ZSBpcyBhIHZhbGlkIGludGVnZXIuIFRoaXMgbWVhbnMgdGhhdCBpdFxuICogaXMgbm9uLW5lZ2F0aXZlLiBJdCBoYXMgbm8gZnJhY3Rpb25hbCBjb21wb25lbnQgYW5kIHRoYXQgaXQgZG9lcyBub3RcbiAqIGV4Y2VlZCB0aGUgbWF4aW11bSBhbGxvd2VkIHZhbHVlLlxuICovXG5mdW5jdGlvbiB2ZXJpZnVpbnQgKHZhbHVlLCBtYXgpIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlID49IDAsICdzcGVjaWZpZWQgYSBuZWdhdGl2ZSB2YWx1ZSBmb3Igd3JpdGluZyBhbiB1bnNpZ25lZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA8PSBtYXgsICd2YWx1ZSBpcyBsYXJnZXIgdGhhbiBtYXhpbXVtIHZhbHVlIGZvciB0eXBlJylcbiAgYXNzZXJ0KE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZSwgJ3ZhbHVlIGhhcyBhIGZyYWN0aW9uYWwgY29tcG9uZW50Jylcbn1cblxuZnVuY3Rpb24gdmVyaWZzaW50ICh2YWx1ZSwgbWF4LCBtaW4pIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGxhcmdlciB0aGFuIG1heGltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA+PSBtaW4sICd2YWx1ZSBzbWFsbGVyIHRoYW4gbWluaW11bSBhbGxvd2VkIHZhbHVlJylcbiAgYXNzZXJ0KE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZSwgJ3ZhbHVlIGhhcyBhIGZyYWN0aW9uYWwgY29tcG9uZW50Jylcbn1cblxuZnVuY3Rpb24gdmVyaWZJRUVFNzU0ICh2YWx1ZSwgbWF4LCBtaW4pIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGxhcmdlciB0aGFuIG1heGltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA+PSBtaW4sICd2YWx1ZSBzbWFsbGVyIHRoYW4gbWluaW11bSBhbGxvd2VkIHZhbHVlJylcbn1cblxuZnVuY3Rpb24gYXNzZXJ0ICh0ZXN0LCBtZXNzYWdlKSB7XG4gIGlmICghdGVzdCkgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UgfHwgJ0ZhaWxlZCBhc3NlcnRpb24nKVxufVxuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qc1wiLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlclwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBsb29rdXAgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLyc7XG5cbjsoZnVuY3Rpb24gKGV4cG9ydHMpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG4gIHZhciBBcnIgPSAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKVxuICAgID8gVWludDhBcnJheVxuICAgIDogQXJyYXlcblxuXHR2YXIgUExVUyAgID0gJysnLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIICA9ICcvJy5jaGFyQ29kZUF0KDApXG5cdHZhciBOVU1CRVIgPSAnMCcuY2hhckNvZGVBdCgwKVxuXHR2YXIgTE9XRVIgID0gJ2EnLmNoYXJDb2RlQXQoMClcblx0dmFyIFVQUEVSICA9ICdBJy5jaGFyQ29kZUF0KDApXG5cdHZhciBQTFVTX1VSTF9TQUZFID0gJy0nLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIX1VSTF9TQUZFID0gJ18nLmNoYXJDb2RlQXQoMClcblxuXHRmdW5jdGlvbiBkZWNvZGUgKGVsdCkge1xuXHRcdHZhciBjb2RlID0gZWx0LmNoYXJDb2RlQXQoMClcblx0XHRpZiAoY29kZSA9PT0gUExVUyB8fFxuXHRcdCAgICBjb2RlID09PSBQTFVTX1VSTF9TQUZFKVxuXHRcdFx0cmV0dXJuIDYyIC8vICcrJ1xuXHRcdGlmIChjb2RlID09PSBTTEFTSCB8fFxuXHRcdCAgICBjb2RlID09PSBTTEFTSF9VUkxfU0FGRSlcblx0XHRcdHJldHVybiA2MyAvLyAnLydcblx0XHRpZiAoY29kZSA8IE5VTUJFUilcblx0XHRcdHJldHVybiAtMSAvL25vIG1hdGNoXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIgKyAxMClcblx0XHRcdHJldHVybiBjb2RlIC0gTlVNQkVSICsgMjYgKyAyNlxuXHRcdGlmIChjb2RlIDwgVVBQRVIgKyAyNilcblx0XHRcdHJldHVybiBjb2RlIC0gVVBQRVJcblx0XHRpZiAoY29kZSA8IExPV0VSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIExPV0VSICsgMjZcblx0fVxuXG5cdGZ1bmN0aW9uIGI2NFRvQnl0ZUFycmF5IChiNjQpIHtcblx0XHR2YXIgaSwgaiwgbCwgdG1wLCBwbGFjZUhvbGRlcnMsIGFyclxuXG5cdFx0aWYgKGI2NC5sZW5ndGggJSA0ID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0cmluZy4gTGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA0Jylcblx0XHR9XG5cblx0XHQvLyB0aGUgbnVtYmVyIG9mIGVxdWFsIHNpZ25zIChwbGFjZSBob2xkZXJzKVxuXHRcdC8vIGlmIHRoZXJlIGFyZSB0d28gcGxhY2Vob2xkZXJzLCB0aGFuIHRoZSB0d28gY2hhcmFjdGVycyBiZWZvcmUgaXRcblx0XHQvLyByZXByZXNlbnQgb25lIGJ5dGVcblx0XHQvLyBpZiB0aGVyZSBpcyBvbmx5IG9uZSwgdGhlbiB0aGUgdGhyZWUgY2hhcmFjdGVycyBiZWZvcmUgaXQgcmVwcmVzZW50IDIgYnl0ZXNcblx0XHQvLyB0aGlzIGlzIGp1c3QgYSBjaGVhcCBoYWNrIHRvIG5vdCBkbyBpbmRleE9mIHR3aWNlXG5cdFx0dmFyIGxlbiA9IGI2NC5sZW5ndGhcblx0XHRwbGFjZUhvbGRlcnMgPSAnPScgPT09IGI2NC5jaGFyQXQobGVuIC0gMikgPyAyIDogJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDEpID8gMSA6IDBcblxuXHRcdC8vIGJhc2U2NCBpcyA0LzMgKyB1cCB0byB0d28gY2hhcmFjdGVycyBvZiB0aGUgb3JpZ2luYWwgZGF0YVxuXHRcdGFyciA9IG5ldyBBcnIoYjY0Lmxlbmd0aCAqIDMgLyA0IC0gcGxhY2VIb2xkZXJzKVxuXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIHBsYWNlaG9sZGVycywgb25seSBnZXQgdXAgdG8gdGhlIGxhc3QgY29tcGxldGUgNCBjaGFyc1xuXHRcdGwgPSBwbGFjZUhvbGRlcnMgPiAwID8gYjY0Lmxlbmd0aCAtIDQgOiBiNjQubGVuZ3RoXG5cblx0XHR2YXIgTCA9IDBcblxuXHRcdGZ1bmN0aW9uIHB1c2ggKHYpIHtcblx0XHRcdGFycltMKytdID0gdlxuXHRcdH1cblxuXHRcdGZvciAoaSA9IDAsIGogPSAwOyBpIDwgbDsgaSArPSA0LCBqICs9IDMpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTgpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgMTIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPDwgNikgfCBkZWNvZGUoYjY0LmNoYXJBdChpICsgMykpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDAwMCkgPj4gMTYpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDApID4+IDgpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0aWYgKHBsYWNlSG9sZGVycyA9PT0gMikge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpID4+IDQpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fSBlbHNlIGlmIChwbGFjZUhvbGRlcnMgPT09IDEpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTApIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgNCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA+PiAyKVxuXHRcdFx0cHVzaCgodG1wID4+IDgpICYgMHhGRilcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9XG5cblx0XHRyZXR1cm4gYXJyXG5cdH1cblxuXHRmdW5jdGlvbiB1aW50OFRvQmFzZTY0ICh1aW50OCkge1xuXHRcdHZhciBpLFxuXHRcdFx0ZXh0cmFCeXRlcyA9IHVpbnQ4Lmxlbmd0aCAlIDMsIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG5cdFx0XHRvdXRwdXQgPSBcIlwiLFxuXHRcdFx0dGVtcCwgbGVuZ3RoXG5cblx0XHRmdW5jdGlvbiBlbmNvZGUgKG51bSkge1xuXHRcdFx0cmV0dXJuIGxvb2t1cC5jaGFyQXQobnVtKVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG5cdFx0XHRyZXR1cm4gZW5jb2RlKG51bSA+PiAxOCAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiAxMiAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiA2ICYgMHgzRikgKyBlbmNvZGUobnVtICYgMHgzRilcblx0XHR9XG5cblx0XHQvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG5cdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gdWludDgubGVuZ3RoIC0gZXh0cmFCeXRlczsgaSA8IGxlbmd0aDsgaSArPSAzKSB7XG5cdFx0XHR0ZW1wID0gKHVpbnQ4W2ldIDw8IDE2KSArICh1aW50OFtpICsgMV0gPDwgOCkgKyAodWludDhbaSArIDJdKVxuXHRcdFx0b3V0cHV0ICs9IHRyaXBsZXRUb0Jhc2U2NCh0ZW1wKVxuXHRcdH1cblxuXHRcdC8vIHBhZCB0aGUgZW5kIHdpdGggemVyb3MsIGJ1dCBtYWtlIHN1cmUgdG8gbm90IGZvcmdldCB0aGUgZXh0cmEgYnl0ZXNcblx0XHRzd2l0Y2ggKGV4dHJhQnl0ZXMpIHtcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0dGVtcCA9IHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAyKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9ICc9PSdcblx0XHRcdFx0YnJlYWtcblx0XHRcdGNhc2UgMjpcblx0XHRcdFx0dGVtcCA9ICh1aW50OFt1aW50OC5sZW5ndGggLSAyXSA8PCA4KSArICh1aW50OFt1aW50OC5sZW5ndGggLSAxXSlcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDEwKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wID4+IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCAyKSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPSdcblx0XHRcdFx0YnJlYWtcblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0cHV0XG5cdH1cblxuXHRleHBvcnRzLnRvQnl0ZUFycmF5ID0gYjY0VG9CeXRlQXJyYXlcblx0ZXhwb3J0cy5mcm9tQnl0ZUFycmF5ID0gdWludDhUb0Jhc2U2NFxufSh0eXBlb2YgZXhwb3J0cyA9PT0gJ3VuZGVmaW5lZCcgPyAodGhpcy5iYXNlNjRqcyA9IHt9KSA6IGV4cG9ydHMpKVxuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYi9iNjQuanNcIixcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2Jhc2U2NC1qcy9saWJcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG5leHBvcnRzLnJlYWQgPSBmdW5jdGlvbiAoYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbVxuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIG5CaXRzID0gLTdcbiAgdmFyIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMFxuICB2YXIgZCA9IGlzTEUgPyAtMSA6IDFcbiAgdmFyIHMgPSBidWZmZXJbb2Zmc2V0ICsgaV1cblxuICBpICs9IGRcblxuICBlID0gcyAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBzID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBlTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IGUgPSBlICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgbSA9IGUgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgZSA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gbUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBtID0gbSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhc1xuICB9IGVsc2UgaWYgKGUgPT09IGVNYXgpIHtcbiAgICByZXR1cm4gbSA/IE5hTiA6ICgocyA/IC0xIDogMSkgKiBJbmZpbml0eSlcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pXG4gICAgZSA9IGUgLSBlQmlhc1xuICB9XG4gIHJldHVybiAocyA/IC0xIDogMSkgKiBtICogTWF0aC5wb3coMiwgZSAtIG1MZW4pXG59XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbiAoYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGNcbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMClcbiAgdmFyIGkgPSBpc0xFID8gMCA6IChuQnl0ZXMgLSAxKVxuICB2YXIgZCA9IGlzTEUgPyAxIDogLTFcbiAgdmFyIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDBcblxuICB2YWx1ZSA9IE1hdGguYWJzKHZhbHVlKVxuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwXG4gICAgZSA9IGVNYXhcbiAgfSBlbHNlIHtcbiAgICBlID0gTWF0aC5mbG9vcihNYXRoLmxvZyh2YWx1ZSkgLyBNYXRoLkxOMilcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS1cbiAgICAgIGMgKj0gMlxuICAgIH1cbiAgICBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIHZhbHVlICs9IHJ0IC8gY1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcylcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKytcbiAgICAgIGMgLz0gMlxuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDBcbiAgICAgIGUgPSBlTWF4XG4gICAgfSBlbHNlIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgbSA9ICh2YWx1ZSAqIGMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gZSArIGVCaWFzXG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IDBcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KSB7fVxuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG1cbiAgZUxlbiArPSBtTGVuXG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCkge31cblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjhcbn1cblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanNcIixcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTRcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4vLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG5wcm9jZXNzLm5leHRUaWNrID0gKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgY2FuU2V0SW1tZWRpYXRlID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cuc2V0SW1tZWRpYXRlO1xuICAgIHZhciBjYW5Qb3N0ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cucG9zdE1lc3NhZ2UgJiYgd2luZG93LmFkZEV2ZW50TGlzdGVuZXJcbiAgICA7XG5cbiAgICBpZiAoY2FuU2V0SW1tZWRpYXRlKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoZikgeyByZXR1cm4gd2luZG93LnNldEltbWVkaWF0ZShmKSB9O1xuICAgIH1cblxuICAgIGlmIChjYW5Qb3N0KSB7XG4gICAgICAgIHZhciBxdWV1ZSA9IFtdO1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldikge1xuICAgICAgICAgICAgdmFyIHNvdXJjZSA9IGV2LnNvdXJjZTtcbiAgICAgICAgICAgIGlmICgoc291cmNlID09PSB3aW5kb3cgfHwgc291cmNlID09PSBudWxsKSAmJiBldi5kYXRhID09PSAncHJvY2Vzcy10aWNrJykge1xuICAgICAgICAgICAgICAgIGV2LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgIGlmIChxdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmbiA9IHF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgICAgIHF1ZXVlLnB1c2goZm4pO1xuICAgICAgICAgICAgd2luZG93LnBvc3RNZXNzYWdlKCdwcm9jZXNzLXRpY2snLCAnKicpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICBzZXRUaW1lb3V0KGZuLCAwKTtcbiAgICB9O1xufSkoKTtcblxucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59XG5cbi8vIFRPRE8oc2h0eWxtYW4pXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanNcIixcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEB0eXBlIHtUYWJ9XG4gKi9cbnZhciBUYWIgPSByZXF1aXJlKCcuL3RhYicpO1xuLyoqXG4gKiBAdHlwZSB7Q2hhcHRlcnN9XG4gKi9cbnZhciBDaGFwdGVycyA9IHJlcXVpcmUoJy4vbW9kdWxlcy9jaGFwdGVyJyk7XG5cbmZ1bmN0aW9uIGNyZWF0ZVRpbWVDb250cm9scygpIHtcbiAgcmV0dXJuICQoJzx1bCBjbGFzcz1cInRpbWVjb250cm9sYmFyXCI+PC91bD4nKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlQm94KCkge1xuICByZXR1cm4gJCgnPGRpdiBjbGFzcz1cImNvbnRyb2xiYXIgYmFyXCI+PC9kaXY+Jyk7XG59XG5cbmZ1bmN0aW9uIHBsYXllclN0YXJ0ZWQocGxheWVyKSB7XG4gIHJldHVybiAoKHR5cGVvZiBwbGF5ZXIuY3VycmVudFRpbWUgPT09ICdudW1iZXInKSAmJiAocGxheWVyLmN1cnJlbnRUaW1lID4gMCkpO1xufVxuXG5mdW5jdGlvbiBnZXRDb21iaW5lZENhbGxiYWNrKGNhbGxiYWNrKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoZXZ0KSB7XG4gICAgY29uc29sZS5kZWJ1ZygnQ29udHJvbHMnLCAnY29udHJvbGJ1dHRvbiBjbGlja2VkJywgZXZ0KTtcbiAgICBldnQucHJldmVudERlZmF1bHQoKTtcbiAgICBjb25zb2xlLmRlYnVnKCdDb250cm9scycsICdwbGF5ZXIgc3RhcnRlZD8nLCBwbGF5ZXJTdGFydGVkKHRoaXMucGxheWVyKSk7XG4gICAgaWYgKCFwbGF5ZXJTdGFydGVkKHRoaXMucGxheWVyKSkge1xuICAgICAgdGhpcy5wbGF5ZXIucGxheSgpO1xuICAgIH1cbiAgICB2YXIgYm91bmRDYWxsQmFjayA9IGNhbGxiYWNrLmJpbmQodGhpcyk7XG4gICAgYm91bmRDYWxsQmFjaygpO1xuICB9O1xufVxuXG4vKipcbiAqIGluc3RhbnRpYXRlIG5ldyBjb250cm9scyBlbGVtZW50XG4gKiBAcGFyYW0ge2pRdWVyeXxIVE1MRWxlbWVudH0gcGxheWVyIFBsYXllciBlbGVtZW50IHJlZmVyZW5jZVxuICogQHBhcmFtIHtUaW1lbGluZX0gdGltZWxpbmUgVGltZWxpbmUgb2JqZWN0IGZvciB0aGlzIHBsYXllclxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIENvbnRyb2xzICh0aW1lbGluZSkge1xuICB0aGlzLnBsYXllciA9IHRpbWVsaW5lLnBsYXllcjtcbiAgdGhpcy50aW1lbGluZSA9IHRpbWVsaW5lO1xuICB0aGlzLmJveCA9IGNyZWF0ZUJveCgpO1xuICB0aGlzLnRpbWVDb250cm9sRWxlbWVudCA9IGNyZWF0ZVRpbWVDb250cm9scygpO1xuICB0aGlzLmJveC5hcHBlbmQodGhpcy50aW1lQ29udHJvbEVsZW1lbnQpO1xufVxuXG4vKipcbiAqIGNyZWF0ZSB0aW1lIGNvbnRyb2wgYnV0dG9ucyBhbmQgYWRkIHRoZW0gdG8gdGltZUNvbnRyb2xFbGVtZW50XG4gKiBAcGFyYW0ge251bGx8Q2hhcHRlcnN9IGNoYXB0ZXJNb2R1bGUgd2hlbiBwcmVzZW50IHdpbGwgYWRkIG5leHQgYW5kIHByZXZpb3VzIGNoYXB0ZXIgY29udHJvbHNcbiAqIEByZXR1cm5zIHt2b2lkfVxuICovXG5Db250cm9scy5wcm90b3R5cGUuY3JlYXRlVGltZUNvbnRyb2xzID0gZnVuY3Rpb24gKGNoYXB0ZXJNb2R1bGUpIHtcbiAgdmFyIGhhc0NoYXB0ZXJzID0gKGNoYXB0ZXJNb2R1bGUgaW5zdGFuY2VvZiBDaGFwdGVycyk7XG4gIGlmICghaGFzQ2hhcHRlcnMpIHtcbiAgICBjb25zb2xlLmluZm8oJ0NvbnRyb2xzJywgJ2NyZWF0ZVRpbWVDb250cm9scycsICdubyBjaGFwdGVyVGFiIGZvdW5kJyk7XG4gIH1cbiAgaWYgKGhhc0NoYXB0ZXJzKSB7XG4gICAgdGhpcy5jcmVhdGVCdXR0b24oJ3B3cC1jb250cm9scy1wcmV2aW91cy1jaGFwdGVyJywgJ0p1bXAgYmFja3dhcmQgdG8gcHJldmlvdXMgY2hhcHRlcicsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBhY3RpdmVDaGFwdGVyID0gY2hhcHRlck1vZHVsZS5nZXRBY3RpdmVDaGFwdGVyKCk7XG4gICAgICBpZiAodGhpcy50aW1lbGluZS5nZXRUaW1lKCkgPiBhY3RpdmVDaGFwdGVyLnN0YXJ0ICsgMTApIHtcbiAgICAgICAgY29uc29sZS5kZWJ1ZygnQ29udHJvbHMnLCAnYmFjayB0byBjaGFwdGVyIHN0YXJ0JywgY2hhcHRlck1vZHVsZS5jdXJyZW50Q2hhcHRlciwgJ2Zyb20nLCB0aGlzLnRpbWVsaW5lLmdldFRpbWUoKSk7XG4gICAgICAgIHJldHVybiBjaGFwdGVyTW9kdWxlLnBsYXlDdXJyZW50Q2hhcHRlcigpO1xuICAgICAgfVxuICAgICAgY29uc29sZS5kZWJ1ZygnQ29udHJvbHMnLCAnYmFjayB0byBwcmV2aW91cyBjaGFwdGVyJywgY2hhcHRlck1vZHVsZS5jdXJyZW50Q2hhcHRlcik7XG4gICAgICByZXR1cm4gY2hhcHRlck1vZHVsZS5wcmV2aW91cygpO1xuICAgIH0pO1xuICB9XG5cbiAgdGhpcy5jcmVhdGVCdXR0b24oJ3B3cC1jb250cm9scy1iYWNrLTMwJywgJ1Jld2luZCAzMCBzZWNvbmRzJywgZnVuY3Rpb24gKCkge1xuICAgIGNvbnNvbGUuZGVidWcoJ0NvbnRyb2xzJywgJ3Jld2luZCBiZWZvcmUnLCB0aGlzLnRpbWVsaW5lLmdldFRpbWUoKSk7XG4gICAgdGhpcy50aW1lbGluZS5zZXRUaW1lKHRoaXMudGltZWxpbmUuZ2V0VGltZSgpIC0gMzApO1xuICAgIGNvbnNvbGUuZGVidWcoJ0NvbnRyb2xzJywgJ3Jld2luZCBhZnRlcicsIHRoaXMudGltZWxpbmUuZ2V0VGltZSgpKTtcbiAgfSk7XG5cbiAgdGhpcy5jcmVhdGVCdXR0b24oJ3B3cC1jb250cm9scy1mb3J3YXJkLTMwJywgJ0Zhc3QgZm9yd2FyZCAzMCBzZWNvbmRzJywgZnVuY3Rpb24gKCkge1xuICAgIGNvbnNvbGUuZGVidWcoJ0NvbnRyb2xzJywgJ2Zmd2QgYmVmb3JlJywgdGhpcy50aW1lbGluZS5nZXRUaW1lKCkpO1xuICAgIHRoaXMudGltZWxpbmUuc2V0VGltZSh0aGlzLnRpbWVsaW5lLmdldFRpbWUoKSArIDMwKTtcbiAgICBjb25zb2xlLmRlYnVnKCdDb250cm9scycsICdmZndkIGFmdGVyJywgdGhpcy50aW1lbGluZS5nZXRUaW1lKCkpO1xuICB9KTtcblxuICBpZiAoaGFzQ2hhcHRlcnMpIHtcbiAgICB0aGlzLmNyZWF0ZUJ1dHRvbigncHdwLWNvbnRyb2xzLW5leHQtY2hhcHRlcicsICdKdW1wIHRvIG5leHQgY2hhcHRlcicsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGNvbnNvbGUuZGVidWcoJ0NvbnRyb2xzJywgJ25leHQgQ2hhcHRlciBiZWZvcmUnLCB0aGlzLnRpbWVsaW5lLmdldFRpbWUoKSk7XG4gICAgICBjaGFwdGVyTW9kdWxlLm5leHQoKTtcbiAgICAgIGNvbnNvbGUuZGVidWcoJ0NvbnRyb2xzJywgJ25leHQgQ2hhcHRlciBhZnRlcicsIHRoaXMudGltZWxpbmUuZ2V0VGltZSgpKTtcbiAgICB9KTtcbiAgfVxufTtcblxuQ29udHJvbHMucHJvdG90eXBlLmNyZWF0ZUJ1dHRvbiA9IGZ1bmN0aW9uIGNyZWF0ZUJ1dHRvbihpY29uLCB0aXRsZSwgY2FsbGJhY2spIHtcbiAgdmFyIGJ1dHRvbiA9ICQoJzxsaT48YSBocmVmPVwiI1wiIGNsYXNzPVwiYnV0dG9uIGJ1dHRvbi1jb250cm9sXCIgdGl0bGU9XCInICsgdGl0bGUgKyAnXCI+JyArXG4gICAgJzxpIGNsYXNzPVwiaWNvbiAnICsgaWNvbiArICdcIj48L2k+PC9hPjwvbGk+Jyk7XG4gIHRoaXMudGltZUNvbnRyb2xFbGVtZW50LmFwcGVuZChidXR0b24pO1xuICB2YXIgY29tYmluZWRDYWxsYmFjayA9IGdldENvbWJpbmVkQ2FsbGJhY2soY2FsbGJhY2spO1xuICBidXR0b24ub24oJ2NsaWNrJywgY29tYmluZWRDYWxsYmFjay5iaW5kKHRoaXMpKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ29udHJvbHM7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvY29udHJvbHMuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbi8vIGV2ZXJ5dGhpbmcgZm9yIGFuIGVtYmVkZGVkIHBsYXllclxudmFyXG4gIHBsYXllcnMgPSBbXSxcbiAgbGFzdEhlaWdodCA9IDAsXG4gICRib2R5O1xuXG5mdW5jdGlvbiBwb3N0VG9PcGVuZXIob2JqKSB7XG4gIGNvbnNvbGUuZGVidWcoJ3Bvc3RUb09wZW5lcicsIG9iaik7XG4gIHdpbmRvdy5wYXJlbnQucG9zdE1lc3NhZ2Uob2JqLCAnKicpO1xufVxuXG5mdW5jdGlvbiBtZXNzYWdlTGlzdGVuZXIgKGV2ZW50KSB7XG4gIHZhciBvcmlnID0gZXZlbnQub3JpZ2luYWxFdmVudDtcblxuICBpZiAob3JpZy5kYXRhLmFjdGlvbiA9PT0gJ3BhdXNlJykge1xuICAgIHBsYXllcnMuZm9yRWFjaChmdW5jdGlvbiAocGxheWVyKSB7XG4gICAgICBwbGF5ZXIucGF1c2UoKTtcbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiB3YWl0Rm9yTWV0YWRhdGEgKGNhbGxiYWNrKSB7XG4gIGZ1bmN0aW9uIG1ldGFEYXRhTGlzdGVuZXIgKGV2ZW50KSB7XG4gICAgdmFyIG9yaWcgPSBldmVudC5vcmlnaW5hbEV2ZW50O1xuICAgIGlmIChvcmlnLmRhdGEucGxheWVyT3B0aW9ucykge1xuICAgICAgY2FsbGJhY2sob3JpZy5kYXRhLnBsYXllck9wdGlvbnMpO1xuICAgIH1cbiAgfVxuICAkKHdpbmRvdykub24oJ21lc3NhZ2UnLCBtZXRhRGF0YUxpc3RlbmVyKTtcbn1cblxuZnVuY3Rpb24gcG9sbEhlaWdodCgpIHtcbiAgdmFyIG5ld0hlaWdodCA9ICRib2R5LmhlaWdodCgpO1xuICBpZiAobGFzdEhlaWdodCAhPT0gbmV3SGVpZ2h0KSB7XG4gICAgcG9zdFRvT3BlbmVyKHtcbiAgICAgIGFjdGlvbjogJ3Jlc2l6ZScsXG4gICAgICBhcmc6IG5ld0hlaWdodFxuICAgIH0pO1xuICB9XG5cbiAgbGFzdEhlaWdodCA9IG5ld0hlaWdodDtcbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHBvbGxIZWlnaHQsIGRvY3VtZW50LmJvZHkpO1xufVxuXG4vKipcbiAqIGluaXRpYWxpemUgZW1iZWQgZnVuY3Rpb25hbGl0eVxuICogQHBhcmFtIHtmdW5jdGlvbn0gJCBqUXVlcnlcbiAqIEBwYXJhbSB7QXJyYXl9IHBsYXllckxpc3QgYWxsIHBsYXllcnNpbiB0aGlzIHdpbmRvd1xuICogQHJldHVybnMge3ZvaWR9XG4gKi9cbmZ1bmN0aW9uIGluaXQoJCwgcGxheWVyTGlzdCkge1xuICBwbGF5ZXJzID0gcGxheWVyTGlzdDtcbiAgJGJvZHkgPSAkKGRvY3VtZW50LmJvZHkpO1xuICAkKHdpbmRvdykub24oJ21lc3NhZ2UnLCBtZXNzYWdlTGlzdGVuZXIpO1xuICBwb2xsSGVpZ2h0KCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBwb3N0VG9PcGVuZXI6IHBvc3RUb09wZW5lcixcbiAgd2FpdEZvck1ldGFkYXRhOiB3YWl0Rm9yTWV0YWRhdGEsXG4gIGluaXQ6IGluaXRcbn07XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvZW1iZWQuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4vKiohXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBQb2Rsb3ZlIFdlYiBQbGF5ZXIgdjMuMC4wLWFscGhhXG4gKiBMaWNlbnNlZCB1bmRlciBUaGUgQlNEIDItQ2xhdXNlIExpY2Vuc2VcbiAqIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9CU0QtMi1DbGF1c2VcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIENvcHlyaWdodCAoYykgMjAxNCwgR2Vycml0IHZhbiBBYWtlbiAoaHR0cHM6Ly9naXRodWIuY29tL2dlcnJpdHZhbmFha2VuLyksIFNpbW9uIFdhbGRoZXJyIChodHRwczovL2dpdGh1Yi5jb20vc2ltb253YWxkaGVyci8pLCBGcmFuayBIYXNlIChodHRwczovL2dpdGh1Yi5jb20vS2FtYmZoYXNlLyksIEVyaWMgVGV1YmVydCAoaHR0cHM6Ly9naXRodWIuY29tL2V0ZXViZXJ0LykgYW5kIG90aGVycyAoaHR0cHM6Ly9naXRodWIuY29tL3BvZGxvdmUvcG9kbG92ZS13ZWItcGxheWVyL2NvbnRyaWJ1dG9ycylcbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0IG1vZGlmaWNhdGlvbiwgYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmUgbWV0OlxuICpcbiAqIC0gUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuICogLSBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIgaW4gdGhlIGRvY3VtZW50YXRpb24gYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZCB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG4gKlxuICogVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCBCWSBUSEUgQ09QWVJJR0hUIEhPTERFUlMgQU5EIENPTlRSSUJVVE9SUyBcIkFTIElTXCIgQU5EIEFOWSBFWFBSRVNTIE9SIElNUExJRUQgV0FSUkFOVElFUywgSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkUgRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIENPUFlSSUdIVCBIT0xERVIgT1IgQ09OVFJJQlVUT1JTIEJFIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgUFJPQ1VSRU1FTlQgT0YgU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsIE9SIFBST0ZJVFM7IE9SIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWSBUSEVPUlkgT0YgTElBQklMSVRZLCBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUIChJTkNMVURJTkcgTkVHTElHRU5DRSBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTIFNPRlRXQVJFLCBFVkVOIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBUYWJSZWdpc3RyeSA9IHJlcXVpcmUoJy4vdGFicmVnaXN0cnknKSxcbiAgZW1iZWQgPSByZXF1aXJlKCcuL2VtYmVkJyksXG4gIFRpbWVsaW5lID0gcmVxdWlyZSgnLi90aW1lbGluZScpLFxuICBJbmZvID0gcmVxdWlyZSgnLi9tb2R1bGVzL2luZm8nKSxcbiAgU2hhcmUgPSByZXF1aXJlKCcuL21vZHVsZXMvc2hhcmUnKSxcbiAgRG93bmxvYWRzID0gcmVxdWlyZSgnLi9tb2R1bGVzL2Rvd25sb2FkcycpLFxuICBDaGFwdGVycyA9IHJlcXVpcmUoJy4vbW9kdWxlcy9jaGFwdGVyJyksXG4gIFNhdmVUaW1lID0gcmVxdWlyZSgnLi9tb2R1bGVzL3NhdmV0aW1lJyksXG4gIENvbnRyb2xzID0gcmVxdWlyZSgnLi9jb250cm9scycpLFxuICBQbGF5ZXIgPSByZXF1aXJlKCcuL3BsYXllcicpLFxuICBQcm9ncmVzc0JhciA9IHJlcXVpcmUoJy4vbW9kdWxlcy9wcm9ncmVzc2JhcicpO1xuXG52YXIgYXV0b3BsYXkgPSBmYWxzZTtcblxudmFyIHB3cDtcblxuLy8gd2lsbCBleHBvc2UvYXR0YWNoIGl0c2VsZiB0byB0aGUgJCBnbG9iYWxcbnJlcXVpcmUoJy4uLy4uL2Jvd2VyX2NvbXBvbmVudHMvbWVkaWFlbGVtZW50L2J1aWxkL21lZGlhZWxlbWVudC5qcycpO1xuXG4vKipcbiAqIFRoZSBtb3N0IG1pc3NpbmcgZmVhdHVyZSByZWdhcmRpbmcgZW1iZWRkZWQgcGxheWVyc1xuICogQHBhcmFtIHtzdHJpbmd9IHRpdGxlIHRoZSB0aXRsZSBvZiB0aGUgc2hvd1xuICogQHBhcmFtIHtzdHJpbmd9IHVybCAob3B0aW9uYWwpIHRoZSBsaW5rIHRvIHRoZSBzaG93XG4gKiBAcmV0dXJucyB7c3RyaW5nfVxuICovXG5mdW5jdGlvbiByZW5kZXJTaG93VGl0bGUodGl0bGUsIHVybCkge1xuICBpZiAoIXRpdGxlKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG4gIGlmICh1cmwpIHtcbiAgICB0aXRsZSA9ICc8YSBocmVmPVwiJyArIHVybCArICdcIj4nICsgdGl0bGUgKyAnPC9hPic7XG4gIH1cbiAgcmV0dXJuICc8aDMgY2xhc3M9XCJzaG93dGl0bGVcIj4nICsgdGl0bGUgKyAnPC9oMz4nO1xufVxuXG4vKipcbiAqIFJlbmRlciBlcGlzb2RlIHRpdGxlIEhUTUxcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0XG4gKiBAcGFyYW0ge3N0cmluZ30gbGlua1xuICogQHJldHVybnMge3N0cmluZ31cbiAqL1xuZnVuY3Rpb24gcmVuZGVyVGl0bGUodGV4dCwgbGluaykge1xuICB2YXIgdGl0bGVCZWdpbiA9ICc8aDEgY2xhc3M9XCJlcGlzb2RldGl0bGVcIj4nLFxuICAgIHRpdGxlRW5kID0gJzwvaDE+JztcbiAgaWYgKHRleHQgIT09IHVuZGVmaW5lZCAmJiBsaW5rICE9PSB1bmRlZmluZWQpIHtcbiAgICB0ZXh0ID0gJzxhIGhyZWY9XCInICsgbGluayArICdcIj4nICsgdGV4dCArICc8L2E+JztcbiAgfVxuICByZXR1cm4gdGl0bGVCZWdpbiArIHRleHQgKyB0aXRsZUVuZDtcbn1cblxuLyoqXG4gKiBSZW5kZXIgSFRNTCBzdWJ0aXRsZVxuICogQHBhcmFtIHtzdHJpbmd9IHRleHRcbiAqIEByZXR1cm5zIHtzdHJpbmd9XG4gKi9cbmZ1bmN0aW9uIHJlbmRlclN1YlRpdGxlKHRleHQpIHtcbiAgaWYgKCF0ZXh0KSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG4gIHJldHVybiAnPGgyIGNsYXNzPVwic3VidGl0bGVcIj4nICsgdGV4dCArICc8L2gyPic7XG59XG5cbi8qKlxuICogUmVuZGVyIEhUTUwgdGl0bGUgYXJlYVxuICogQHBhcmFtIHBhcmFtc1xuICogQHJldHVybnMge3N0cmluZ31cbiAqL1xuZnVuY3Rpb24gcmVuZGVyVGl0bGVBcmVhKHBhcmFtcykge1xuICByZXR1cm4gJzxoZWFkZXI+JyArXG4gICAgcmVuZGVyU2hvd1RpdGxlKHBhcmFtcy5zaG93LnRpdGxlLCBwYXJhbXMuc2hvdy51cmwpICtcbiAgICByZW5kZXJUaXRsZShwYXJhbXMudGl0bGUsIHBhcmFtcy5wZXJtYWxpbmspICtcbiAgICByZW5kZXJTdWJUaXRsZShwYXJhbXMuc3VidGl0bGUpICtcbiAgICAnPC9oZWFkZXI+Jztcbn1cblxuLyoqXG4gKiBSZW5kZXIgSFRNTCBwbGF5YnV0dG9uXG4gKiBAcmV0dXJucyB7c3RyaW5nfVxuICovXG5mdW5jdGlvbiByZW5kZXJQbGF5YnV0dG9uKCkge1xuICByZXR1cm4gJCgnPGEgY2xhc3M9XCJwbGF5XCIgdGl0bGU9XCJQbGF5IEVwaXNvZGVcIiBocmVmPVwiamF2YXNjcmlwdDo7XCI+PC9hPicpO1xufVxuXG4vKipcbiAqIFJlbmRlciB0aGUgcG9zdGVyIGltYWdlIGluIEhUTUxcbiAqIHJldHVybnMgYW4gZW1wdHkgc3RyaW5nIGlmIHBvc3RlclVybCBpcyBlbXB0eVxuICogQHBhcmFtIHtzdHJpbmd9IHBvc3RlclVybFxuICogQHJldHVybnMge3N0cmluZ30gcmVuZGVyZWQgSFRNTFxuICovXG5mdW5jdGlvbiByZW5kZXJQb3N0ZXIocG9zdGVyVXJsKSB7XG4gIGlmICghcG9zdGVyVXJsKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG4gIHJldHVybiAnPGRpdiBjbGFzcz1cImNvdmVyYXJ0XCI+PGltZyBjbGFzcz1cImNvdmVyaW1nXCIgc3JjPVwiJyArIHBvc3RlclVybCArICdcIiBkYXRhLWltZz1cIicgKyBwb3N0ZXJVcmwgKyAnXCIgYWx0PVwiUG9zdGVyIEltYWdlXCI+PC9kaXY+Jztcbn1cblxuLyoqXG4gKiBjaGVja3MgaWYgdGhlIGN1cnJlbnQgd2luZG93IGlzIGhpZGRlblxuICogQHJldHVybnMge2Jvb2xlYW59IHRydWUgaWYgdGhlIHdpbmRvdyBpcyBoaWRkZW5cbiAqL1xuZnVuY3Rpb24gaXNIaWRkZW4oKSB7XG4gIHZhciBwcm9wcyA9IFtcbiAgICAnaGlkZGVuJyxcbiAgICAnbW96SGlkZGVuJyxcbiAgICAnbXNIaWRkZW4nLFxuICAgICd3ZWJraXRIaWRkZW4nXG4gIF07XG5cbiAgZm9yICh2YXIgaW5kZXggaW4gcHJvcHMpIHtcbiAgICBpZiAocHJvcHNbaW5kZXhdIGluIGRvY3VtZW50KSB7XG4gICAgICByZXR1cm4gISFkb2N1bWVudFtwcm9wc1tpbmRleF1dO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIHJlbmRlck1vZHVsZXModGltZWxpbmUsIHdyYXBwZXIsIHBhcmFtcykge1xuICB2YXJcbiAgICB0YWJzID0gbmV3IFRhYlJlZ2lzdHJ5KCksXG4gICAgaGFzQ2hhcHRlcnMgPSB0aW1lbGluZS5oYXNDaGFwdGVycyxcbiAgICBjb250cm9scyA9IG5ldyBDb250cm9scyh0aW1lbGluZSksXG4gICAgY29udHJvbEJveCA9IGNvbnRyb2xzLmJveDtcblxuICAvKipcbiAgICogLS0gTU9EVUxFUyAtLVxuICAgKi9cbiAgdmFyIGNoYXB0ZXJzO1xuICBpZiAoaGFzQ2hhcHRlcnMpIHtcbiAgICBjaGFwdGVycyA9IG5ldyBDaGFwdGVycyh0aW1lbGluZSwgcGFyYW1zKTtcbiAgICB0aW1lbGluZS5hZGRNb2R1bGUoY2hhcHRlcnMpO1xuICAgIGNoYXB0ZXJzLmFkZEV2ZW50aGFuZGxlcnMoKTtcbiAgfVxuICBjb250cm9scy5jcmVhdGVUaW1lQ29udHJvbHMoY2hhcHRlcnMpO1xuXG4gIHZhciBzYXZlVGltZSA9IG5ldyBTYXZlVGltZSh0aW1lbGluZSwgcGFyYW1zKTtcbiAgdGltZWxpbmUuYWRkTW9kdWxlKHNhdmVUaW1lKTtcblxuICB2YXIgcHJvZ3Jlc3NCYXIgPSBuZXcgUHJvZ3Jlc3NCYXIodGltZWxpbmUpO1xuICB0aW1lbGluZS5hZGRNb2R1bGUocHJvZ3Jlc3NCYXIpO1xuXG4gIHZhciBzaGFyaW5nID0gbmV3IFNoYXJlKHBhcmFtcyk7XG4gIHZhciBkb3dubG9hZHMgPSBuZXcgRG93bmxvYWRzKHBhcmFtcyk7XG4gIHZhciBpbmZvcyA9IG5ldyBJbmZvKHBhcmFtcyk7XG5cbiAgLyoqXG4gICAqIC0tIFRBQlMgLS1cbiAgICogVGhlIHRhYnMgaW4gY29udHJvbGJhciB3aWxsIGFwcGVhciBpbiBmb2xsb3dpbmcgb3JkZXI6XG4gICAqL1xuXG4gIGlmIChoYXNDaGFwdGVycykge1xuICAgIHRhYnMuYWRkKGNoYXB0ZXJzLnRhYik7XG4gIH1cblxuICB0YWJzLmFkZChzaGFyaW5nLnRhYik7XG4gIHRhYnMuYWRkKGRvd25sb2Fkcy50YWIpO1xuICB0YWJzLmFkZChpbmZvcy50YWIpO1xuXG4gIHRhYnMub3BlbkluaXRpYWwocGFyYW1zLmFjdGl2ZVRhYik7XG5cbiAgLy8gUmVuZGVyIGNvbnRyb2xiYXIgd2l0aCB0b2dnbGViYXIgYW5kIHRpbWVjb250cm9sc1xuICB2YXIgY29udHJvbGJhcldyYXBwZXIgPSAkKCc8ZGl2IGNsYXNzPVwiY29udHJvbGJhci13cmFwcGVyXCI+PC9kaXY+Jyk7XG4gIGNvbnRyb2xiYXJXcmFwcGVyLmFwcGVuZCh0YWJzLnRvZ2dsZWJhcik7XG4gIGNvbnRyb2xiYXJXcmFwcGVyLmFwcGVuZChjb250cm9sQm94KTtcblxuICAvLyByZW5kZXIgcHJvZ3Jlc3NiYXIsIGNvbnRyb2xiYXIgYW5kIHRhYnNcbiAgd3JhcHBlclxuICAgIC5hcHBlbmQocHJvZ3Jlc3NCYXIucmVuZGVyKCkpXG4gICAgLmFwcGVuZChjb250cm9sYmFyV3JhcHBlcilcbiAgICAuYXBwZW5kKHRhYnMuY29udGFpbmVyKTtcblxuICBwcm9ncmVzc0Jhci5hZGRFdmVudHMoKTtcbn1cblxuLyoqXG4gKiBhZGQgY2hhcHRlciBiZWhhdmlvciBhbmQgZGVlcGxpbmtpbmc6IHNraXAgdG8gcmVmZXJlbmNlZFxuICogdGltZSBwb3NpdGlvbiAmIHdyaXRlIGN1cnJlbnQgdGltZSBpbnRvIGFkZHJlc3NcbiAqIEBwYXJhbSB7b2JqZWN0fSBwbGF5ZXJcbiAqIEBwYXJhbSB7b2JqZWN0fSBwYXJhbXNcbiAqIEBwYXJhbSB7b2JqZWN0fSB3cmFwcGVyXG4gKi9cbmZ1bmN0aW9uIGFkZEJlaGF2aW9yKHBsYXllciwgcGFyYW1zLCB3cmFwcGVyKSB7XG4gIHZhciBqcVBsYXllciA9ICQocGxheWVyKSxcbiAgICB0aW1lbGluZSA9IG5ldyBUaW1lbGluZShwbGF5ZXIsIHBhcmFtcyksXG5cbiAgICBtZXRhRWxlbWVudCA9ICQoJzxkaXYgY2xhc3M9XCJ0aXRsZWJhclwiPjwvZGl2PicpLFxuICAgIHBsYXllclR5cGUgPSBwYXJhbXMudHlwZSxcbiAgICBwbGF5QnV0dG9uID0gcmVuZGVyUGxheWJ1dHRvbigpLFxuICAgIHBvc3RlciA9IHBhcmFtcy5wb3N0ZXIgfHwganFQbGF5ZXIuYXR0cigncG9zdGVyJyk7XG5cbiAgdmFyIGRlZXBMaW5rO1xuXG4gIGNvbnNvbGUuZGVidWcoJ3dlYnBsYXllcicsICdtZXRhZGF0YScsIHRpbWVsaW5lLmdldERhdGEoKSk7XG4gIGpxUGxheWVyLnByb3Aoe1xuICAgIGNvbnRyb2xzOiBudWxsLFxuICAgIHByZWxvYWQ6ICdtZXRhZGF0YSdcbiAgfSk7XG5cbiAgLyoqXG4gICAqIEJ1aWxkIHJpY2ggcGxheWVyIHdpdGggbWV0YSBkYXRhXG4gICAqL1xuICB3cmFwcGVyXG4gICAgLmFkZENsYXNzKCdwb2Rsb3Zld2VicGxheWVyXycgKyBwbGF5ZXJUeXBlKVxuICAgIC5kYXRhKCdwb2Rsb3Zld2VicGxheWVyJywge1xuICAgIHBsYXllcjoganFQbGF5ZXJcbiAgfSk7XG5cbiAgaWYgKHBsYXllclR5cGUgPT09ICdhdWRpbycpIHtcbiAgICAvLyBSZW5kZXIgcGxheWJ1dHRvbiBpbiB0aXRsZWJhclxuICAgIG1ldGFFbGVtZW50LnByZXBlbmQocGxheUJ1dHRvbik7XG4gICAgbWV0YUVsZW1lbnQuYXBwZW5kKHJlbmRlclBvc3Rlcihwb3N0ZXIpKTtcbiAgICB3cmFwcGVyLnByZXBlbmQobWV0YUVsZW1lbnQpO1xuICB9XG5cbiAgaWYgKHBsYXllclR5cGUgPT09ICd2aWRlbycpIHtcbiAgICB2YXIgdmlkZW9QYW5lID0gJCgnPGRpdiBjbGFzcz1cInZpZGVvLXBhbmVcIj48L2Rpdj4nKTtcbiAgICB2YXIgb3ZlcmxheSA9ICQoJzxkaXYgY2xhc3M9XCJ2aWRlby1vdmVybGF5XCI+PC9kaXY+Jyk7XG4gICAgb3ZlcmxheS5hcHBlbmQocGxheUJ1dHRvbik7XG4gICAgb3ZlcmxheS5vbignY2xpY2snLCBmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAocGxheWVyLnBhdXNlZCkge1xuICAgICAgICBwbGF5QnV0dG9uLmFkZENsYXNzKCdwbGF5aW5nJyk7XG4gICAgICAgIHBsYXllci5wbGF5KCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHBsYXlCdXR0b24ucmVtb3ZlQ2xhc3MoJ3BsYXlpbmcnKTtcbiAgICAgIHBsYXllci5wYXVzZSgpO1xuICAgIH0pO1xuXG4gICAgdmlkZW9QYW5lXG4gICAgICAuYXBwZW5kKG92ZXJsYXkpXG4gICAgICAuYXBwZW5kKGpxUGxheWVyKTtcblxuICAgIHdyYXBwZXJcbiAgICAgIC5hcHBlbmQobWV0YUVsZW1lbnQpXG4gICAgICAuYXBwZW5kKHZpZGVvUGFuZSk7XG5cbiAgICBqcVBsYXllci5wcm9wKHtwb3N0ZXI6IHBvc3Rlcn0pO1xuICB9XG5cbiAgLy8gUmVuZGVyIHRpdGxlIGFyZWEgd2l0aCB0aXRsZSBoMiBhbmQgc3VidGl0bGUgaDNcbiAgbWV0YUVsZW1lbnQuYXBwZW5kKHJlbmRlclRpdGxlQXJlYShwYXJhbXMpKTtcblxuICAvLyBwYXJzZSBkZWVwbGlua1xuICBkZWVwTGluayA9IHJlcXVpcmUoJy4vdXJsJykuY2hlY2tDdXJyZW50KCk7XG4gIGlmIChkZWVwTGlua1swXSAmJiBwd3AucGxheWVycy5sZW5ndGggPT09IDEpIHtcbiAgICB2YXIgcGxheWVyQXR0cmlidXRlcyA9IHtwcmVsb2FkOiAnYXV0byd9O1xuICAgIGlmICghaXNIaWRkZW4oKSkge1xuICAgICAgcGxheWVyQXR0cmlidXRlcy5hdXRvcGxheSA9ICdhdXRvcGxheSc7XG4gICAgfVxuICAgIGpxUGxheWVyLmF0dHIocGxheWVyQXR0cmlidXRlcyk7XG4gICAgLy9zdG9wQXRUaW1lID0gZGVlcExpbmtbMV07XG4gICAgdGltZWxpbmUucGxheVJhbmdlKGRlZXBMaW5rKTtcblxuICAgICQoJ2h0bWwsIGJvZHknKS5kZWxheSgxNTApLmFuaW1hdGUoe1xuICAgICAgc2Nyb2xsVG9wOiAkKCcuY29udGFpbmVyOmZpcnN0Jykub2Zmc2V0KCkudG9wIC0gMjVcbiAgICB9KTtcbiAgfVxuXG4gIHBsYXlCdXR0b24ub24oJ2NsaWNrJywgZnVuY3Rpb24gKGV2dCkge1xuICAgIGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGV2dC5zdG9wUHJvcGFnYXRpb24oKTtcblxuICAgIGlmIChwbGF5ZXIuY3VycmVudFRpbWUgJiYgcGxheWVyLmN1cnJlbnRUaW1lID4gMCAmJiAhcGxheWVyLnBhdXNlZCkge1xuICAgICAgcGxheUJ1dHRvbi5yZW1vdmVDbGFzcygncGxheWluZycpO1xuICAgICAgcGxheWVyLnBhdXNlKCk7XG4gICAgICBpZiAocGxheWVyLnBsdWdpblR5cGUgPT09ICdmbGFzaCcpIHtcbiAgICAgICAgcGxheWVyLnBhdXNlKCk7ICAgIC8vIGZsYXNoIGZhbGxiYWNrIG5lZWRzIGFkZGl0aW9uYWwgcGF1c2VcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIXBsYXlCdXR0b24uaGFzQ2xhc3MoJ3BsYXlpbmcnKSkge1xuICAgICAgcGxheUJ1dHRvbi5hZGRDbGFzcygncGxheWluZycpO1xuICAgIH1cbiAgICBwbGF5ZXIucGxheSgpO1xuICB9KTtcblxuICAvLyB3YWl0IGZvciB0aGUgcGxheWVyIG9yIHlvdSdsbCBnZXQgRE9NIEVYQ0VQVElPTlNcbiAgLy8gQW5kIGp1c3QgbGlzdGVuIG9uY2UgYmVjYXVzZSBvZiBhIHNwZWNpYWwgYmVoYXZpb3VyIGluIGZpcmVmb3hcbiAgLy8gLS0+IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTY2NDg0MlxuICBqcVBsYXllci5vbmUoJ2NhbnBsYXknLCBmdW5jdGlvbiAoZXZ0KSB7XG4gICAgY29uc29sZS5kZWJ1ZygnY2FucGxheScsIGV2dCk7XG4gICAgdGltZWxpbmUuZHVyYXRpb24gPSBwbGF5ZXIuZHVyYXRpb247XG4gICAgLy8gYXR0YWNoIGFuZCByZW5kZXIgbW9kdWxlc1xuICAgIHJlbmRlck1vZHVsZXModGltZWxpbmUsIHdyYXBwZXIsIHBhcmFtcyk7XG4gIH0pO1xuXG4gICQoZG9jdW1lbnQpXG4gICAgLm9uKCdrZXlkb3duJywgZnVuY3Rpb24gKGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdwcm9ncmVzcycsICdrZXlkb3duJywgZSk7XG4gICAgICAvKlxuICAgICAgIGlmICgobmV3IERhdGUoKSAtIGxhc3RLZXlQcmVzc1RpbWUpID49IDEwMDApIHtcbiAgICAgICBzdGFydGVkUGF1c2VkID0gbWVkaWEucGF1c2VkO1xuICAgICAgIH1cbiAgICAgICAqL1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcblxuICAgICAgdmFyIGtleUNvZGUgPSBlLndoaWNoLFxuICAgICAgICBkdXJhdGlvbiA9IHRpbWVsaW5lLnBsYXllci5kdXJhdGlvbixcbiAgICAgICAgc2Vla1RpbWUgPSB0aW1lbGluZS5wbGF5ZXIuY3VycmVudFRpbWU7XG5cbiAgICAgIHN3aXRjaCAoa2V5Q29kZSkge1xuICAgICAgICBjYXNlIDM3OiAvLyBsZWZ0XG4gICAgICAgICAgc2Vla1RpbWUgLT0gMTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAzOTogLy8gUmlnaHRcbiAgICAgICAgICBzZWVrVGltZSArPSAxO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDM4OiAvLyBVcFxuICAgICAgICAgIGlmICh0aW1lbGluZS5oYXNDaGFwdGVycykge1xuICAgICAgICAgICAgdGltZWxpbmUubW9kdWxlc1swXS5uZXh0KCk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNlZWtUaW1lICs9IE1hdGguZmxvb3IoZHVyYXRpb24gKiAwLjEpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDQwOiAvLyBEb3duXG4gICAgICAgICAgaWYgKHRpbWVsaW5lLmhhc0NoYXB0ZXJzKSB7XG4gICAgICAgICAgICB0aW1lbGluZS5tb2R1bGVzWzBdLnByZXZpb3VzKCk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNlZWtUaW1lIC09IE1hdGguZmxvb3IoZHVyYXRpb24gKiAwLjEpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDM2OiAvLyBIb21lXG4gICAgICAgICAgc2Vla1RpbWUgPSAwO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDM1OiAvLyBlbmRcbiAgICAgICAgICBzZWVrVGltZSA9IGR1cmF0aW9uO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDEwOiAvLyBlbnRlclxuICAgICAgICBjYXNlIDMyOiAvLyBzcGFjZVxuICAgICAgICAgIGlmICh0aW1lbGluZS5wbGF5ZXIucGF1c2VkKSB7XG4gICAgICAgICAgICB0aW1lbGluZS5wbGF5ZXIucGxheSgpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICAgIHRpbWVsaW5lLnBsYXllci5wYXVzZSgpO1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIHRpbWVsaW5lLnNldFRpbWUoc2Vla1RpbWUpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pO1xuXG4gIGpxUGxheWVyXG4gICAgLm9uKCd0aW1lbGluZUVsZW1lbnQnLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgIGNvbnNvbGUubG9nKGV2ZW50LmN1cnJlbnRUYXJnZXQuaWQsIGV2ZW50KTtcbiAgICB9KVxuICAgIC5vbigndGltZXVwZGF0ZSBwcm9ncmVzcycsIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgdGltZWxpbmUudXBkYXRlKGV2ZW50KTtcbiAgICB9KVxuICAgIC8vIHVwZGF0ZSBwbGF5L3BhdXNlIHN0YXR1c1xuICAgIC5vbigncGxheScsIGZ1bmN0aW9uICgpIHt9KVxuICAgIC5vbigncGxheWluZycsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHBsYXlCdXR0b24uYWRkQ2xhc3MoJ3BsYXlpbmcnKTtcbiAgICAgIGVtYmVkLnBvc3RUb09wZW5lcih7IGFjdGlvbjogJ3BsYXknLCBhcmc6IHBsYXllci5jdXJyZW50VGltZSB9KTtcbiAgICB9KVxuICAgIC5vbigncGF1c2UnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBwbGF5QnV0dG9uLnJlbW92ZUNsYXNzKCdwbGF5aW5nJyk7XG4gICAgICBlbWJlZC5wb3N0VG9PcGVuZXIoeyBhY3Rpb246ICdwYXVzZScsIGFyZzogcGxheWVyLmN1cnJlbnRUaW1lIH0pO1xuICAgIH0pXG4gICAgLm9uKCdlbmRlZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGVtYmVkLnBvc3RUb09wZW5lcih7IGFjdGlvbjogJ3N0b3AnLCBhcmc6IHBsYXllci5jdXJyZW50VGltZSB9KTtcbiAgICAgIC8vIGRlbGV0ZSB0aGUgY2FjaGVkIHBsYXkgdGltZVxuICAgICAgdGltZWxpbmUucmV3aW5kKCk7XG4gICAgfSk7XG59XG5cbi8qKlxuICogcmV0dXJuIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbCBhdHRhY2ggc291cmNlIGVsZW1lbnRzIHRvIHRoZSBkZWZlcnJlZCBhdWRpbyBlbGVtZW50XG4gKiBAcGFyYW0ge29iamVjdH0gZGVmZXJyZWRQbGF5ZXJcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAqL1xuZnVuY3Rpb24gZ2V0RGVmZXJyZWRQbGF5ZXJDYWxsQmFjayhkZWZlcnJlZFBsYXllcikge1xuICByZXR1cm4gZnVuY3Rpb24gKGRhdGEpIHtcbiAgICB2YXIgcGFyYW1zID0gJC5leHRlbmQoe30sIFBsYXllci5kZWZhdWx0cywgZGF0YSk7XG4gICAgZGF0YS5zb3VyY2VzLmZvckVhY2goZnVuY3Rpb24gKHNvdXJjZU9iamVjdCkge1xuICAgICAgJCgnPHNvdXJjZT4nLCBzb3VyY2VPYmplY3QpLmFwcGVuZFRvKGRlZmVycmVkUGxheWVyKTtcbiAgICB9KTtcbiAgICBQbGF5ZXIuY3JlYXRlKGRlZmVycmVkUGxheWVyLCBwYXJhbXMsIGFkZEJlaGF2aW9yKTtcbiAgfTtcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm5zIHtqUXVlcnl9XG4gKi9cbiQuZm4ucG9kbG92ZXdlYnBsYXllciA9IGZ1bmN0aW9uIHdlYlBsYXllcihvcHRpb25zKSB7XG4gIGlmIChvcHRpb25zLmRlZmVycmVkKSB7XG4gICAgdmFyIGRlZmVycmVkUGxheWVyID0gdGhpc1swXTtcbiAgICB2YXIgY2FsbGJhY2sgPSBnZXREZWZlcnJlZFBsYXllckNhbGxCYWNrKGRlZmVycmVkUGxheWVyKTtcbiAgICBlbWJlZC53YWl0Rm9yTWV0YWRhdGEoY2FsbGJhY2spO1xuICAgIGVtYmVkLnBvc3RUb09wZW5lcih7YWN0aW9uOiAnd2FpdGluZyd9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIEFkZGl0aW9uYWwgcGFyYW1ldGVycyBkZWZhdWx0IHZhbHVlc1xuICB2YXIgcGFyYW1zID0gJC5leHRlbmQoe30sIFBsYXllci5kZWZhdWx0cywgb3B0aW9ucyk7XG5cbiAgLy8gdHVybiBlYWNoIHBsYXllciBpbiB0aGUgY3VycmVudCBzZXQgaW50byBhIFBvZGxvdmUgV2ViIFBsYXllclxuICByZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uIChpLCBwbGF5ZXJFbGVtZW50KSB7XG4gICAgUGxheWVyLmNyZWF0ZShwbGF5ZXJFbGVtZW50LCBwYXJhbXMsIGFkZEJlaGF2aW9yKTtcbiAgfSk7XG59O1xuXG5wd3AgPSB7IHBsYXllcnM6IFBsYXllci5wbGF5ZXJzIH07XG5cbmVtYmVkLmluaXQoJCwgUGxheWVyLnBsYXllcnMpO1xuXG53aW5kb3cucHdwID0gcHdwO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2Zha2VfNzk5YTQwZDEuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciB0YyA9IHJlcXVpcmUoJy4uL3RpbWVjb2RlJylcbiAgLCB1cmwgPSByZXF1aXJlKCcuLi91cmwnKVxuICAsIFRhYiA9IHJlcXVpcmUoJy4uL3RhYicpXG4gICwgVGltZWxpbmUgPSByZXF1aXJlKCcuLi90aW1lbGluZScpO1xuXG52YXIgQUNUSVZFX0NIQVBURVJfVEhSRVNISE9MRCA9IDAuMTtcblxuZnVuY3Rpb24gdHJhbnNmb3JtQ2hhcHRlcihjaGFwdGVyKSB7XG4gIGNoYXB0ZXIuY29kZSA9IGNoYXB0ZXIudGl0bGU7XG4gIGlmICh0eXBlb2YgY2hhcHRlci5zdGFydCA9PT0gJ3N0cmluZycpIHtcbiAgICBjaGFwdGVyLnN0YXJ0ID0gdGMuZ2V0U3RhcnRUaW1lQ29kZShjaGFwdGVyLnN0YXJ0KTtcbiAgfVxuICByZXR1cm4gY2hhcHRlcjtcbn1cblxuLyoqXG4gKiBhZGQgYGVuZGAgcHJvcGVydHkgdG8gZWFjaCBzaW1wbGUgY2hhcHRlcixcbiAqIG5lZWRlZCBmb3IgcHJvcGVyIGZvcm1hdHRpbmdcbiAqIEBwYXJhbSB7bnVtYmVyfSBkdXJhdGlvblxuICogQHJldHVybnMge2Z1bmN0aW9ufVxuICovXG5mdW5jdGlvbiBhZGRFbmRUaW1lKGR1cmF0aW9uKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoY2hhcHRlciwgaSwgY2hhcHRlcnMpIHtcbiAgICB2YXIgbmV4dCA9IGNoYXB0ZXJzW2kgKyAxXTtcbiAgICBjaGFwdGVyLmVuZCA9IG5leHQgPyBuZXh0LnN0YXJ0IDogZHVyYXRpb247XG4gICAgY29uc29sZS5sb2coJ2R1cmF0aW9uJywgZHVyYXRpb24sIGNoYXB0ZXIuZW5kKTtcbiAgICByZXR1cm4gY2hhcHRlcjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyKGh0bWwpIHtcbiAgcmV0dXJuICQoaHRtbCk7XG59XG5cbi8qKlxuICogcmVuZGVyIEhUTUxUYWJsZUVsZW1lbnQgZm9yIGNoYXB0ZXJzXG4gKiBAcmV0dXJucyB7alF1ZXJ5fEhUTUxFbGVtZW50fVxuICovXG5mdW5jdGlvbiByZW5kZXJDaGFwdGVyVGFibGUoKSB7XG4gIHJldHVybiByZW5kZXIoXG4gICAgJzx0YWJsZSBjbGFzcz1cInBvZGxvdmV3ZWJwbGF5ZXJfY2hhcHRlcnNcIj48Y2FwdGlvbj5Qb2RjYXN0IENoYXB0ZXJzPC9jYXB0aW9uPicgK1xuICAgICAgJzx0aGVhZD4nICtcbiAgICAgICAgJzx0cj4nICtcbiAgICAgICAgICAnPHRoIHNjb3BlPVwiY29sXCI+Q2hhcHRlciBOdW1iZXI8L3RoPicgK1xuICAgICAgICAgICc8dGggc2NvcGU9XCJjb2xcIj5TdGFydCB0aW1lPC90aD4nICtcbiAgICAgICAgICAnPHRoIHNjb3BlPVwiY29sXCI+VGl0bGU8L3RoPicgK1xuICAgICAgICAgICc8dGggc2NvcGU9XCJjb2xcIj5EdXJhdGlvbjwvdGg+JyArXG4gICAgICAgICc8L3RyPicgK1xuICAgICAgJzwvdGhlYWQ+JyArXG4gICAgICAnPHRib2R5PjwvdGJvZHk+JyArXG4gICAgJzwvdGFibGU+J1xuICApO1xufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gY2hhcHRlclxuICogQHJldHVybnMge2pRdWVyeXxIVE1MRWxlbWVudH1cbiAqL1xuZnVuY3Rpb24gcmVuZGVyUm93IChjaGFwdGVyLCBpbmRleCkge1xuICByZXR1cm4gcmVuZGVyKFxuICAgICc8dHIgY2xhc3M9XCJjaGFwdGVyXCI+JyArXG4gICAgICAnPHRkIGNsYXNzPVwiY2hhcHRlci1udW1iZXJcIj48c3BhbiBjbGFzcz1cImJhZGdlXCI+JyArIChpbmRleCArIDEpICsgJzwvc3Bhbj48L3RkPicgK1xuICAgICAgJzx0ZCBjbGFzcz1cImNoYXB0ZXItbmFtZVwiPjxzcGFuPicgKyBjaGFwdGVyLmNvZGUgKyAnPC9zcGFuPjwvdGQ+JyArXG4gICAgICAnPHRkIGNsYXNzPVwiY2hhcHRlci1kdXJhdGlvblwiPjxzcGFuPicgKyBjaGFwdGVyLmR1cmF0aW9uICsgJzwvc3Bhbj48L3RkPicgK1xuICAgICc8L3RyPidcbiAgKTtcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtBcnJheX0gY2hhcHRlcnNcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbmZ1bmN0aW9uIGdldE1heENoYXB0ZXJTdGFydChjaGFwdGVycykge1xuICBmdW5jdGlvbiBnZXRTdGFydFRpbWUgKGNoYXB0ZXIpIHtcbiAgICByZXR1cm4gY2hhcHRlci5zdGFydDtcbiAgfVxuICByZXR1cm4gTWF0aC5tYXguYXBwbHkoTWF0aCwgJC5tYXAoY2hhcHRlcnMsIGdldFN0YXJ0VGltZSkpO1xufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge3tlbmQ6e251bWJlcn0sIHN0YXJ0OntudW1iZXJ9fX0gY2hhcHRlclxuICogQHBhcmFtIHtudW1iZXJ9IGN1cnJlbnRUaW1lXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuZnVuY3Rpb24gaXNBY3RpdmVDaGFwdGVyIChjaGFwdGVyLCBjdXJyZW50VGltZSkge1xuICBpZiAoIWNoYXB0ZXIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIChjdXJyZW50VGltZSA+IGNoYXB0ZXIuc3RhcnQgLSBBQ1RJVkVfQ0hBUFRFUl9USFJFU0hIT0xEICYmIGN1cnJlbnRUaW1lIDw9IGNoYXB0ZXIuZW5kKTtcbn1cblxuLyoqXG4gKiB1cGRhdGUgdGhlIGNoYXB0ZXIgbGlzdCB3aGVuIHRoZSBkYXRhIGlzIGxvYWRlZFxuICogQHBhcmFtIHtUaW1lbGluZX0gdGltZWxpbmVcbiAqL1xuZnVuY3Rpb24gdXBkYXRlICh0aW1lbGluZSkge1xuICB2YXIgYWN0aXZlQ2hhcHRlciA9IHRoaXMuZ2V0QWN0aXZlQ2hhcHRlcigpXG4gICAgLCBjdXJyZW50VGltZSA9IHRpbWVsaW5lLmdldFRpbWUoKTtcblxuICBjb25zb2xlLmRlYnVnKCdDaGFwdGVycycsICd1cGRhdGUnLCB0aGlzLCBhY3RpdmVDaGFwdGVyLCBjdXJyZW50VGltZSk7XG4gIGlmIChpc0FjdGl2ZUNoYXB0ZXIoYWN0aXZlQ2hhcHRlciwgY3VycmVudFRpbWUpKSB7XG4gICAgY29uc29sZS5sb2coJ0NoYXB0ZXJzJywgJ3VwZGF0ZScsICdhbHJlYWR5IHNldCcsIHRoaXMuY3VycmVudENoYXB0ZXIpO1xuICAgIHJldHVybjtcbiAgfVxuICBmdW5jdGlvbiBtYXJrQ2hhcHRlciAoY2hhcHRlciwgaSkge1xuICAgIHZhciBpc0FjdGl2ZSA9IGlzQWN0aXZlQ2hhcHRlcihjaGFwdGVyLCBjdXJyZW50VGltZSk7XG4gICAgaWYgKGlzQWN0aXZlKSB7XG4gICAgICB0aGlzLnNldEN1cnJlbnRDaGFwdGVyKGkpO1xuICAgIH1cbiAgfVxuICB0aGlzLmNoYXB0ZXJzLmZvckVhY2gobWFya0NoYXB0ZXIsIHRoaXMpO1xufVxuXG4vKipcbiAqIGNoYXB0ZXIgaGFuZGxpbmdcbiAqIEBwYXJhbXMge1RpbWVsaW5lfSBwYXJhbXNcbiAqIEByZXR1cm4ge0NoYXB0ZXJzfSBjaGFwdGVyIG1vZHVsZVxuICovXG5mdW5jdGlvbiBDaGFwdGVycyAodGltZWxpbmUsIHBhcmFtcykge1xuXG4gIGlmICghdGltZWxpbmUgfHwgIXRpbWVsaW5lLmhhc0NoYXB0ZXJzKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgaWYgKHRpbWVsaW5lLmR1cmF0aW9uID09PSAwKSB7XG4gICAgY29uc29sZS53YXJuKCdDaGFwdGVycycsICdjb25zdHJ1Y3RvcicsICdaZXJvIGxlbmd0aCBtZWRpYT8nLCB0aW1lbGluZSk7XG4gIH1cblxuICB0aGlzLnRpbWVsaW5lID0gdGltZWxpbmU7XG4gIHRoaXMuZHVyYXRpb24gPSB0aW1lbGluZS5kdXJhdGlvbjtcbiAgdGhpcy5jaGFwdGVybGlua3MgPSAhIXRpbWVsaW5lLmNoYXB0ZXJsaW5rcztcbiAgdGhpcy5jdXJyZW50Q2hhcHRlciA9IDA7XG4gIHRoaXMuY2hhcHRlcnMgPSB0aGlzLnBhcnNlU2ltcGxlQ2hhcHRlcihwYXJhbXMpO1xuICB0aGlzLmRhdGEgPSB0aGlzLmNoYXB0ZXJzO1xuXG4gIHRoaXMudGFiID0gbmV3IFRhYih7XG4gICAgaWNvbjogJ3B3cC1jaGFwdGVycycsXG4gICAgdGl0bGU6ICdTaG93L2hpZGUgY2hhcHRlcnMnLFxuICAgIGhlYWRsaW5lOiAnQ2hhcHRlcnMnLFxuICAgIG5hbWU6ICdwb2Rsb3Zld2VicGxheWVyX2NoYXB0ZXJib3gnXG4gIH0pO1xuXG4gIHRoaXMudGFiXG4gICAgLmNyZWF0ZU1haW5Db250ZW50KCcnKVxuICAgIC5hcHBlbmQodGhpcy5nZW5lcmF0ZVRhYmxlKCkpO1xuXG4gIHRoaXMudXBkYXRlID0gdXBkYXRlLmJpbmQodGhpcyk7XG59XG5cbi8qKlxuICogR2l2ZW4gYSBsaXN0IG9mIGNoYXB0ZXJzLCB0aGlzIGZ1bmN0aW9uIGNyZWF0ZXMgdGhlIGNoYXB0ZXIgdGFibGUgZm9yIHRoZSBwbGF5ZXIuXG4gKiBAcmV0dXJucyB7alF1ZXJ5fEhUTUxEaXZFbGVtZW50fVxuICovXG5DaGFwdGVycy5wcm90b3R5cGUuZ2VuZXJhdGVUYWJsZSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHRhYmxlLCB0Ym9keSwgbWF4Y2hhcHRlcnN0YXJ0LCBmb3JjZUhvdXJzO1xuXG4gIHRhYmxlID0gcmVuZGVyQ2hhcHRlclRhYmxlKCk7XG4gIHRib2R5ID0gdGFibGUuY2hpbGRyZW4oJ3Rib2R5Jyk7XG5cbiAgaWYgKHRoaXMuY2hhcHRlcmxpbmtzICE9PSAnZmFsc2UnKSB7XG4gICAgdGFibGUuYWRkQ2xhc3MoJ2xpbmtlZCBsaW5rZWRfJyArIHRoaXMuY2hhcHRlcmxpbmtzKTtcbiAgfVxuXG4gIG1heGNoYXB0ZXJzdGFydCA9IGdldE1heENoYXB0ZXJTdGFydCh0aGlzLmNoYXB0ZXJzKTtcbiAgZm9yY2VIb3VycyA9IChtYXhjaGFwdGVyc3RhcnQgPj0gMzYwMCk7XG5cbiAgZnVuY3Rpb24gYnVpbGRDaGFwdGVyKGkpIHtcbiAgICB2YXIgZHVyYXRpb24gPSBNYXRoLnJvdW5kKHRoaXMuZW5kIC0gdGhpcy5zdGFydCksXG4gICAgICByb3c7XG4gICAgLy9tYWtlIHN1cmUgdGhlIGR1cmF0aW9uIGZvciBhbGwgY2hhcHRlcnMgYXJlIGVxdWFsbHkgZm9ybWF0dGVkXG4gICAgdGhpcy5kdXJhdGlvbiA9IHRjLmdlbmVyYXRlKFtkdXJhdGlvbl0sIGZhbHNlKTtcblxuICAgIC8vaWYgdGhlcmUgaXMgYSBjaGFwdGVyIHRoYXQgc3RhcnRzIGFmdGVyIGFuIGhvdXIsIGZvcmNlICcwMDonIG9uIGFsbCBwcmV2aW91cyBjaGFwdGVyc1xuICAgIC8vaW5zZXJ0IHRoZSBjaGFwdGVyIGRhdGFcbiAgICB0aGlzLnN0YXJ0VGltZSA9IHRjLmdlbmVyYXRlKFtNYXRoLnJvdW5kKHRoaXMuc3RhcnQpXSwgdHJ1ZSwgZm9yY2VIb3Vycyk7XG5cbiAgICByb3cgPSByZW5kZXJSb3codGhpcywgaSk7XG4gICAgaWYgKGkgJSAyKSB7XG4gICAgICByb3cuYWRkQ2xhc3MoJ29kZGNoYXB0ZXInKTtcbiAgICB9XG4gICAgcm93LmFwcGVuZFRvKHRib2R5KTtcbiAgICB0aGlzLmVsZW1lbnQgPSByb3c7XG4gIH1cblxuICAkLmVhY2godGhpcy5jaGFwdGVycywgYnVpbGRDaGFwdGVyKTtcbiAgcmV0dXJuIHRhYmxlO1xufTtcblxuLyoqXG4gKlxuICogQHBhcmFtIHttZWpzLkh0bWxNZWRpYUVsZW1lbnR9IHBsYXllclxuICovXG5DaGFwdGVycy5wcm90b3R5cGUuYWRkRXZlbnRoYW5kbGVycyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHBsYXllciA9IHRoaXMudGltZWxpbmUucGxheWVyO1xuICBmdW5jdGlvbiBvbkNsaWNrKGUpIHtcbiAgICAvLyBlbmFibGUgZXh0ZXJuYWwgbGlua3MgdG8gYmUgb3BlbmVkIGluIGEgbmV3IHRhYiBvciB3aW5kb3dcbiAgICAvLyBjYW5jZWxzIGV2ZW50IHRvIGJ1YmJsZSB1cFxuICAgIGlmIChlLnRhcmdldC5jbGFzc05hbWUgPT09ICdwd3Atb3V0Z29pbmcgYnV0dG9uIGJ1dHRvbi10b2dnbGUnKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgLy9jb25zb2xlLmxvZygnY2hhcHRlciNjbGlja0hhbmRsZXI6IHN0YXJ0IGNoYXB0ZXIgYXQnLCBjaGFwdGVyU3RhcnQpO1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAvLyBCYXNpYyBDaGFwdGVyIE1hcmsgZnVuY3Rpb24gKHdpdGhvdXQgZGVlcGxpbmtpbmcpXG4gICAgY29uc29sZS5sb2coJ0NoYXB0ZXInLCAnY2xpY2tIYW5kbGVyJywgJ3NldEN1cnJlbnRDaGFwdGVyIHRvJywgZS5kYXRhLmluZGV4KTtcbiAgICBlLmRhdGEubW9kdWxlLnNldEN1cnJlbnRDaGFwdGVyKGUuZGF0YS5pbmRleCk7XG4gICAgLy8gZmxhc2ggZmFsbGJhY2sgbmVlZHMgYWRkaXRpb25hbCBwYXVzZVxuICAgIGlmIChwbGF5ZXIucGx1Z2luVHlwZSA9PT0gJ2ZsYXNoJykge1xuICAgICAgcGxheWVyLnBhdXNlKCk7XG4gICAgfVxuICAgIGUuZGF0YS5tb2R1bGUucGxheUN1cnJlbnRDaGFwdGVyKCk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkQ2xpY2tIYW5kbGVyIChjaGFwdGVyLCBpbmRleCkge1xuICAgIGNoYXB0ZXIuZWxlbWVudC5vbignY2xpY2snLCB7bW9kdWxlOiB0aGlzLCBpbmRleDogaW5kZXh9LCBvbkNsaWNrKTtcbiAgfVxuXG4gIHRoaXMuY2hhcHRlcnMuZm9yRWFjaChhZGRDbGlja0hhbmRsZXIsIHRoaXMpO1xufTtcblxuQ2hhcHRlcnMucHJvdG90eXBlLmdldEFjdGl2ZUNoYXB0ZXIgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBhY3RpdmUgPSB0aGlzLmNoYXB0ZXJzW3RoaXMuY3VycmVudENoYXB0ZXJdO1xuICBjb25zb2xlLmxvZygnQ2hhcHRlcnMnLCAnZ2V0QWN0aXZlQ2hhcHRlcicsIGFjdGl2ZSk7XG4gIHJldHVybiBhY3RpdmU7XG59O1xuXG4vKipcbiAqXG4gKiBAcGFyYW0ge251bWJlcn0gY2hhcHRlckluZGV4XG4gKi9cbkNoYXB0ZXJzLnByb3RvdHlwZS5zZXRDdXJyZW50Q2hhcHRlciA9IGZ1bmN0aW9uIChjaGFwdGVySW5kZXgpIHtcbiAgaWYgKGNoYXB0ZXJJbmRleCA8IHRoaXMuY2hhcHRlcnMubGVuZ3RoICYmIGNoYXB0ZXJJbmRleCA+PSAwKSB7XG4gICAgdGhpcy5jdXJyZW50Q2hhcHRlciA9IGNoYXB0ZXJJbmRleDtcbiAgfVxuICB0aGlzLm1hcmtBY3RpdmVDaGFwdGVyKCk7XG4gIGNvbnNvbGUubG9nKCdDaGFwdGVycycsICdzZXRDdXJyZW50Q2hhcHRlcicsICd0bycsIHRoaXMuY3VycmVudENoYXB0ZXIpO1xufTtcblxuQ2hhcHRlcnMucHJvdG90eXBlLm1hcmtBY3RpdmVDaGFwdGVyID0gZnVuY3Rpb24gKCkge1xuICB2YXIgYWN0aXZlQ2hhcHRlciA9IHRoaXMuZ2V0QWN0aXZlQ2hhcHRlcigpO1xuICAkLmVhY2godGhpcy5jaGFwdGVycywgZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZWxlbWVudC5yZW1vdmVDbGFzcygnYWN0aXZlJyk7XG4gIH0pO1xuICBhY3RpdmVDaGFwdGVyLmVsZW1lbnQuYWRkQ2xhc3MoJ2FjdGl2ZScpO1xufTtcblxuQ2hhcHRlcnMucHJvdG90eXBlLm5leHQgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBjdXJyZW50ID0gdGhpcy5jdXJyZW50Q2hhcHRlcixcbiAgICBuZXh0ID0gdGhpcy5zZXRDdXJyZW50Q2hhcHRlcihjdXJyZW50ICsgMSk7XG4gIGlmIChjdXJyZW50ID09PSBuZXh0KSB7XG4gICAgY29uc29sZS5sb2coJ0NoYXB0ZXJzJywgJ25leHQnLCAnYWxyZWFkeSBpbiBsYXN0IGNoYXB0ZXInKTtcbiAgICByZXR1cm4gY3VycmVudDtcbiAgfVxuICBjb25zb2xlLmxvZygnQ2hhcHRlcnMnLCAnbmV4dCcsICdjaGFwdGVyJywgdGhpcy5jdXJyZW50Q2hhcHRlcik7XG4gIHRoaXMucGxheUN1cnJlbnRDaGFwdGVyKCk7XG4gIHJldHVybiBuZXh0O1xufTtcblxuQ2hhcHRlcnMucHJvdG90eXBlLnByZXZpb3VzID0gZnVuY3Rpb24gKCkge1xuICB2YXIgY3VycmVudCA9IHRoaXMuY3VycmVudENoYXB0ZXIsXG4gICAgcHJldmlvdXMgPSB0aGlzLnNldEN1cnJlbnRDaGFwdGVyKGN1cnJlbnQgLSAxKTtcbiAgaWYgKGN1cnJlbnQgPT09IHByZXZpb3VzKSB7XG4gICAgY29uc29sZS5kZWJ1ZygnQ2hhcHRlcnMnLCAncHJldmlvdXMnLCAnYWxyZWFkeSBpbiBmaXJzdCBjaGFwdGVyJyk7XG4gICAgdGhpcy5wbGF5Q3VycmVudENoYXB0ZXIoKTtcbiAgICByZXR1cm4gY3VycmVudDtcbiAgfVxuICBjb25zb2xlLmRlYnVnKCdDaGFwdGVycycsICdwcmV2aW91cycsICdjaGFwdGVyJywgdGhpcy5jdXJyZW50Q2hhcHRlcik7XG4gIHRoaXMucGxheUN1cnJlbnRDaGFwdGVyKCk7XG4gIHJldHVybiBwcmV2aW91cztcbn07XG5cbkNoYXB0ZXJzLnByb3RvdHlwZS5wbGF5Q3VycmVudENoYXB0ZXIgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzdGFydCA9IHRoaXMuZ2V0QWN0aXZlQ2hhcHRlcigpLnN0YXJ0O1xuICBjb25zb2xlLmxvZygnQ2hhcHRlcnMnLCAnI3BsYXlDdXJyZW50Q2hhcHRlcicsICdzdGFydCcsIHN0YXJ0KTtcbiAgdmFyIHRpbWUgPSB0aGlzLnRpbWVsaW5lLnNldFRpbWUoc3RhcnQpO1xuICBjb25zb2xlLmxvZygnQ2hhcHRlcnMnLCAnI3BsYXlDdXJyZW50Q2hhcHRlcicsICdjdXJyZW50VGltZScsIHRpbWUpO1xufTtcblxuQ2hhcHRlcnMucHJvdG90eXBlLnBhcnNlU2ltcGxlQ2hhcHRlciA9IGZ1bmN0aW9uIChwYXJhbXMpIHtcbiAgdmFyIGNoYXB0ZXJzID0gcGFyYW1zLmNoYXB0ZXJzO1xuICBpZiAoIWNoYXB0ZXJzKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgcmV0dXJuIGNoYXB0ZXJzXG4gICAgLm1hcCh0cmFuc2Zvcm1DaGFwdGVyKVxuICAgIC5tYXAoYWRkRW5kVGltZSh0aGlzLmR1cmF0aW9uKSlcbiAgICAuc29ydChmdW5jdGlvbiAoYSwgYikgeyAvLyBvcmRlciBpcyBub3QgZ3VhcmFudGVlZDogaHR0cDovL3BvZGxvdmUub3JnL3NpbXBsZS1jaGFwdGVycy9cbiAgICAgIHJldHVybiBhLnN0YXJ0IC0gYi5zdGFydDtcbiAgICB9KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2hhcHRlcnM7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvbW9kdWxlcy9jaGFwdGVyLmpzXCIsXCIvbW9kdWxlc1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIFRhYiA9IHJlcXVpcmUoJy4uL3RhYicpXG4gICwgdGltZUNvZGUgPSByZXF1aXJlKCcuLi90aW1lY29kZScpO1xuXG4vKipcbiAqIENhbGN1bGF0ZSB0aGUgZmlsZXNpemUgaW50byBLQiBhbmQgTUJcbiAqIEBwYXJhbSBzaXplXG4gKiBAcmV0dXJucyB7c3RyaW5nfVxuICovXG5mdW5jdGlvbiBmb3JtYXRTaXplKHNpemUpIHtcbiAgdmFyIG9uZU1iID0gMTA0ODU3NjtcbiAgdmFyIGZpbGVTaXplID0gcGFyc2VJbnQoc2l6ZSwgMTApO1xuICB2YXIga0JGaWxlU2l6ZSA9IE1hdGgucm91bmQoZmlsZVNpemUgLyAxMDI0KTtcbiAgdmFyIG1CRmlsZVNJemUgPSBNYXRoLnJvdW5kKGZpbGVTaXplIC8gMTAyNCAvIDEwMjQpO1xuICBpZiAoIXNpemUpIHtcbiAgICByZXR1cm4gJyAtLSAnO1xuICB9XG4gIC8vIGluIGNhc2UsIHRoZSBmaWxlc2l6ZSBpcyBzbWFsbGVyIHRoYW4gMU1CLFxuICAvLyB0aGUgZm9ybWF0IHdpbGwgYmUgcmVuZGVyZWQgaW4gS0JcbiAgLy8gb3RoZXJ3aXNlIGluIE1CXG4gIHJldHVybiAoZmlsZVNpemUgPCBvbmVNYikgPyBrQkZpbGVTaXplICsgJyBLQicgOiBtQkZpbGVTSXplICsgJyBNQic7XG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSBsaXN0RWxlbWVudFxuICogQHJldHVybnMge3N0cmluZ31cbiAqL1xuZnVuY3Rpb24gY3JlYXRlT3B0aW9uKGxpc3RFbGVtZW50KSB7XG4gIGNvbnNvbGUubG9nKGxpc3RFbGVtZW50KTtcbiAgcmV0dXJuICc8b3B0aW9uPicgKyBsaXN0RWxlbWVudC5hc3NldFRpdGxlICsgJyAmIzgyMjY7ICcgKyBmb3JtYXRTaXplKGxpc3RFbGVtZW50LnNpemUpICsgJzwvb3B0aW9uPic7XG59XG5cbmZ1bmN0aW9uIGdldFBvc3RlckltYWdlKHBhcmFtcykge1xuICB2YXIgZGVmYXVsdFBvc3RlciA9ICcvaW1nL2ljb24tcG9kbG92ZS1zdWJzY3JpYmUtNjAwLnBuZyc7XG4gIHZhciBkZWZhdWx0Q2xhc3MgPSAnZGVmYXVsdC1wb3N0ZXInO1xuXG4gIHZhciBwb3N0ZXIgPSBkZWZhdWx0UG9zdGVyO1xuICBpZiAocGFyYW1zLnNob3cucG9zdGVyKSB7XG4gICAgcG9zdGVyID0gcGFyYW1zLnNob3cucG9zdGVyO1xuICAgIGRlZmF1bHRDbGFzcyA9ICcnO1xuICB9XG4gIGlmIChwYXJhbXMucG9zdGVyKSB7XG4gICAgcG9zdGVyID0gcGFyYW1zLnBvc3RlcjtcbiAgICBkZWZhdWx0Q2xhc3MgPSAnJztcbiAgfVxuXG4gIHJldHVybiAnPGltZyBjbGFzcz1cInBvc3Rlci1pbWFnZSAnICsgZGVmYXVsdENsYXNzICsgJ1wiIHNyYz1cIicgKyBwb3N0ZXIgKyAnXCIgZGF0YS1pbWc9XCInICsgcG9zdGVyICsgJ1wiICcgK1xuICAgICdhbHQ9XCJQb3N0ZXIgSW1hZ2VcIj4nO1xufVxuXG5mdW5jdGlvbiBnZXRQdWJsaWNhdGlvbkRhdGUocmF3RGF0ZSkge1xuICBpZiAoIXJhd0RhdGUpIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgdmFyIGRhdGUgPSBuZXcgRGF0ZShyYXdEYXRlKTtcbiAgcmV0dXJuICc8cD5QdWJsaXNoZWQ6ICcgKyBkYXRlLmdldERhdGUoKSArICcuJyArIGRhdGUuZ2V0TW9udGgoKSArICcuJyArIGRhdGUuZ2V0RnVsbFllYXIoKSArICc8L3A+Jztcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIGVsZW1lbnRcbiAqIEByZXR1cm5zIHt7YXNzZXRUaXRsZTogU3RyaW5nLCBkb3dubG9hZFVybDogU3RyaW5nLCB1cmw6IFN0cmluZywgc2l6ZTogTnVtYmVyfX1cbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplRG93bmxvYWQgKGVsZW1lbnQpIHtcbiAgcmV0dXJuIHtcbiAgICBhc3NldFRpdGxlOiBlbGVtZW50Lm5hbWUsXG4gICAgZG93bmxvYWRVcmw6IGVsZW1lbnQuZGx1cmwsXG4gICAgdXJsOiBlbGVtZW50LnVybCxcbiAgICBzaXplOiBlbGVtZW50LnNpemVcbiAgfTtcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIGVsZW1lbnRcbiAqIEByZXR1cm5zIHt7YXNzZXRUaXRsZTogU3RyaW5nLCBkb3dubG9hZFVybDogU3RyaW5nLCB1cmw6IFN0cmluZywgc2l6ZTogTnVtYmVyfX1cbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplU291cmNlKGVsZW1lbnQpIHtcbiAgdmFyIHNvdXJjZSA9ICh0eXBlb2YgZWxlbWVudCA9PT0gJ3N0cmluZycpID8gZWxlbWVudCA6IGVsZW1lbnQuc3JjO1xuICB2YXIgcGFydHMgPSBzb3VyY2Uuc3BsaXQoJy4nKTtcbiAgcmV0dXJuIHtcbiAgICBhc3NldFRpdGxlOiBwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXSxcbiAgICBkb3dubG9hZFVybDogc291cmNlLFxuICAgIHVybDogc291cmNlLFxuICAgIHNpemU6IC0xXG4gIH07XG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBwYXJhbXNcbiAqIEByZXR1cm5zIHtBcnJheX1cbiAqL1xuZnVuY3Rpb24gY3JlYXRlTGlzdCAocGFyYW1zKSB7XG4gIGlmIChwYXJhbXMuZG93bmxvYWRzICYmIHBhcmFtcy5kb3dubG9hZHNbMF0uYXNzZXRUaXRsZSkge1xuICAgIHJldHVybiBwYXJhbXMuZG93bmxvYWRzO1xuICB9XG5cbiAgaWYgKHBhcmFtcy5kb3dubG9hZHMpIHtcbiAgICByZXR1cm4gcGFyYW1zLmRvd25sb2Fkcy5tYXAobm9ybWFsaXplRG93bmxvYWQpO1xuICB9XG4gIC8vIGJ1aWxkIGZyb20gc291cmNlIGVsZW1lbnRzXG4gIHJldHVybiBwYXJhbXMuc291cmNlcy5tYXAobm9ybWFsaXplU291cmNlKTtcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IHBhcmFtc1xuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIERvd25sb2FkcyAocGFyYW1zKSB7XG4gIHRoaXMubGlzdCA9IGNyZWF0ZUxpc3QocGFyYW1zKTtcbiAgdGhpcy50YWIgPSB0aGlzLmNyZWF0ZURvd25sb2FkVGFiKHBhcmFtcyk7XG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBwYXJhbXNcbiAqIEByZXR1cm5zIHtudWxsfFRhYn0gZG93bmxvYWQgdGFiXG4gKi9cbkRvd25sb2Fkcy5wcm90b3R5cGUuY3JlYXRlRG93bmxvYWRUYWIgPSBmdW5jdGlvbiAocGFyYW1zKSB7XG4gIGlmICgoIXBhcmFtcy5kb3dubG9hZHMgJiYgIXBhcmFtcy5zb3VyY2VzKSB8fCBwYXJhbXMuaGlkZWRvd25sb2FkYnV0dG9uID09PSB0cnVlKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmFyIGRvd25sb2FkVGFiID0gbmV3IFRhYih7XG4gICAgaWNvbjogJ3B3cC1kb3dubG9hZCcsXG4gICAgdGl0bGU6ICdTaG93L2hpZGUgZG93bmxvYWQgYmFyJyxcbiAgICBuYW1lOiAnZG93bmxvYWRzJyxcbiAgICBoZWFkbGluZTogJ0Rvd25sb2FkJ1xuICB9KTtcblxuICB2YXIgJHRhYkNvbnRlbnQgPSBkb3dubG9hZFRhYi5jcmVhdGVNYWluQ29udGVudChcbiAgICAnPGRpdiBjbGFzcz1cImRvd25sb2FkXCI+JyArXG4gICAgJzxmb3JtIGFjdGlvbj1cIlwiIG1ldGhvZD1cIlwiPicgK1xuICAgICAgJzxzZWxlY3QgY2xhc3M9XCJzZWxlY3RcIiBuYW1lPVwic2VsZWN0LWZpbGVcIj4nICsgdGhpcy5saXN0Lm1hcChjcmVhdGVPcHRpb24pICsgJzwvc2VsZWN0PicgK1xuICAgICAgJzxidXR0b24gY2xhc3M9XCJkb3dubG9hZCBidXR0b24tc3VibWl0IGljb24gcHdwLWRvd25sb2FkXCIgbmFtZT1cImRvd25sb2FkLWZpbGVcIj4nICtcbiAgICAgICc8c3BhbiBjbGFzcz1cImRvd25sb2FkIGxhYmVsXCI+RG93bmxvYWQgRXBpc29kZTwvc3Bhbj4nICtcbiAgICAgICc8L2J1dHRvbj4nICtcbiAgICAnPC9mb3JtPicrXG4gICAgJzwvZGl2PidcbiAgKTtcbiAgZG93bmxvYWRUYWIuYm94LmFwcGVuZCgkdGFiQ29udGVudCk7XG5cbiAgLy8gZG93bmxvYWRUYWIuY3JlYXRlRm9vdGVyKCc8aDM+RGlyZWt0ZXIgTGluazwvaDM+JykuYXBwZW5kKGxpbmtJbnB1dCk7XG5cblxuICByZXR1cm4gZG93bmxvYWRUYWI7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IERvd25sb2FkcztcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9tb2R1bGVzL2Rvd25sb2Fkcy5qc1wiLFwiL21vZHVsZXNcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBUYWIgPSByZXF1aXJlKCcuLi90YWInKVxuICAsIHRpbWVDb2RlID0gcmVxdWlyZSgnLi4vdGltZWNvZGUnKVxuICAsIHNlcnZpY2VzID0gcmVxdWlyZSgnLi4vc29jaWFsLW5ldHdvcmtzJyk7XG5cbmZ1bmN0aW9uIGdldFB1YmxpY2F0aW9uRGF0ZShyYXdEYXRlKSB7XG4gIGlmICghcmF3RGF0ZSkge1xuICAgIHJldHVybiAnJztcbiAgfVxuICB2YXIgZGF0ZSA9IG5ldyBEYXRlKHJhd0RhdGUpO1xuICByZXR1cm4gJzxwPlB1Ymxpc2hlZDogJyArIGRhdGUuZ2V0RGF0ZSgpICsgJy4nICsgZGF0ZS5nZXRNb250aCgpICsgJy4nICsgZGF0ZS5nZXRGdWxsWWVhcigpICsgJzwvcD4nO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVFcGlzb2RlSW5mbyh0YWIsIHBhcmFtcykge1xuICB0YWIuY3JlYXRlTWFpbkNvbnRlbnQoXG4gICAgJzxoMj4nICsgcGFyYW1zLnRpdGxlICsgJzwvaDI+JyArXG4gICAgJzxoMz4nICsgcGFyYW1zLnN1YnRpdGxlICsgJzwvaDM+JyArXG4gICAgJzxwPicgKyBwYXJhbXMuc3VtbWFyeSArICc8L3A+JyArXG4gICAgJzxwPkR1cmF0aW9uOiAnICsgdGltZUNvZGUuZnJvbVRpbWVTdGFtcChwYXJhbXMuZHVyYXRpb24pICsgJzwvcD4nICtcbiAgICAgZ2V0UHVibGljYXRpb25EYXRlKHBhcmFtcy5wdWJsaWNhdGlvbkRhdGUpICtcbiAgICAnPHA+JyArXG4gICAgICAnUGVybWFsaW5rIGZvciB0aGlzIGVwaXNvZGU6PGJyPicgK1xuICAgICAgJzxhIGhyZWY9XCInICsgcGFyYW1zLnBlcm1hbGluayArICdcIj4nICsgcGFyYW1zLnBlcm1hbGluayArICc8L2E+JyArXG4gICAgJzwvcD4nXG4gICk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVBvc3RlckltYWdlKHBvc3Rlcikge1xuICBpZiAoIXBvc3Rlcikge1xuICAgIHJldHVybiAnJztcbiAgfVxuICByZXR1cm4gJzxkaXYgY2xhc3M9XCJwb3N0ZXItaW1hZ2VcIj4nICtcbiAgICAnPGltZyBzcmM9XCInICsgcG9zdGVyICsgJ1wiIGRhdGEtaW1nPVwiJyArIHBvc3RlciArICdcIiBhbHQ9XCJQb3N0ZXIgSW1hZ2VcIj4nICtcbiAgICAnPC9kaXY+Jztcbn1cblxuZnVuY3Rpb24gY3JlYXRlU3Vic2NyaWJlQnV0dG9uKHBhcmFtcykge1xuICBpZiAoIXBhcmFtcy5zdWJzY3JpYmVCdXR0b24pIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgcmV0dXJuICc8YnV0dG9uIGNsYXNzPVwiYnV0dG9uLXN1Ym1pdFwiPicgK1xuICAgICAgJzxzcGFuIGNsYXNzPVwic2hvd3RpdGxlLWxhYmVsXCI+JyArIHBhcmFtcy5zaG93LnRpdGxlICsgJzwvc3Bhbj4nICtcbiAgICAgICc8c3BhbiBjbGFzcz1cInN1Ym1pdC1sYWJlbFwiPicgKyBwYXJhbXMuc3Vic2NyaWJlQnV0dG9uICsgJzwvc3Bhbj4nICtcbiAgICAnPC9idXR0b24+Jztcbn1cblxuZnVuY3Rpb24gY3JlYXRlU2hvd0luZm8gKHRhYiwgcGFyYW1zKSB7XG4gIHRhYi5jcmVhdGVBc2lkZShcbiAgICAnPGgyPicgKyBwYXJhbXMuc2hvdy50aXRsZSArICc8L2gyPicgK1xuICAgICc8aDM+JyArIHBhcmFtcy5zaG93LnN1YnRpdGxlICsgJzwvaDM+JyArXG4gICAgY3JlYXRlUG9zdGVySW1hZ2UocGFyYW1zLnNob3cucG9zdGVyKSArXG4gICAgY3JlYXRlU3Vic2NyaWJlQnV0dG9uKHBhcmFtcykgK1xuICAgICc8cD5MaW5rIHRvIHRoZSBzaG93Ojxicj4nICtcbiAgICAgICc8YSBocmVmPVwiJyArIHBhcmFtcy5zaG93LnVybCArICdcIj4nICsgcGFyYW1zLnNob3cudXJsICsgJzwvYT48L3A+J1xuICApO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVTb2NpYWxMaW5rKG9wdGlvbnMpIHtcbiAgdmFyIHNlcnZpY2UgPSBzZXJ2aWNlcy5nZXQob3B0aW9ucy5zZXJ2aWNlTmFtZSk7XG4gIHZhciBsaXN0SXRlbSA9ICQoJzxsaT48L2xpPicpO1xuICB2YXIgYnV0dG9uID0gc2VydmljZS5nZXRCdXR0b24ob3B0aW9ucyk7XG4gIGxpc3RJdGVtLmFwcGVuZChidXR0b24uZWxlbWVudCk7XG4gIHRoaXMuYXBwZW5kKGxpc3RJdGVtKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlU29jaWFsSW5mbyhwcm9maWxlcykge1xuICBpZiAoIXByb2ZpbGVzKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2YXIgcHJvZmlsZUxpc3QgPSAkKCc8dWw+PC91bD4nKTtcbiAgcHJvZmlsZXMuZm9yRWFjaChjcmVhdGVTb2NpYWxMaW5rLCBwcm9maWxlTGlzdCk7XG5cbiAgdmFyIGNvbnRhaW5lciA9ICQoJzxkaXYgY2xhc3M9XCJzb2NpYWwtbGlua3NcIj48aDM+U3RheSBpbiB0b3VjaDwvaDM+PC9kaXY+Jyk7XG4gIGNvbnRhaW5lci5hcHBlbmQocHJvZmlsZUxpc3QpO1xuICByZXR1cm4gY29udGFpbmVyO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVTb2NpYWxBbmRMaWNlbnNlSW5mbyAodGFiLCBwYXJhbXMpIHtcbiAgaWYgKCFwYXJhbXMubGljZW5zZSAmJiAhcGFyYW1zLnByb2ZpbGVzKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHRhYi5jcmVhdGVGb290ZXIoXG4gICAgJzxwPlRoZSBzaG93IFwiJyArIHBhcmFtcy5zaG93LnRpdGxlICsgJ1wiIGlzIGxpY2VuY2VkIHVuZGVyPGJyPicgK1xuICAgICAgJzxhIGhyZWY9XCInICsgcGFyYW1zLmxpY2Vuc2UudXJsICsgJ1wiPicgKyBwYXJhbXMubGljZW5zZS5uYW1lICsgJzwvYT4nICtcbiAgICAnPC9wPidcbiAgKS5wcmVwZW5kKGNyZWF0ZVNvY2lhbEluZm8ocGFyYW1zLnByb2ZpbGVzKSk7XG59XG5cbi8qKlxuICogY3JlYXRlIGluZm8gdGFiIGlmIHBhcmFtcy5zdW1tYXJ5IGlzIGRlZmluZWRcbiAqIEBwYXJhbSB7b2JqZWN0fSBwYXJhbXMgcGFyYW1ldGVyIG9iamVjdFxuICogQHJldHVybnMge251bGx8VGFifSBpbmZvIHRhYiBpbnN0YW5jZSBvciBudWxsXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUluZm9UYWIocGFyYW1zKSB7XG4gIGlmICghcGFyYW1zLnN1bW1hcnkpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2YXIgaW5mb1RhYiA9IG5ldyBUYWIoe1xuICAgIGljb246ICdwd3AtaW5mbycsXG4gICAgdGl0bGU6ICdNb3JlIGluZm9ybWF0aW9uIGFib3V0IHRoaXMnLFxuICAgIGhlYWRsaW5lOiAnSW5mbycsXG4gICAgbmFtZTogJ2luZm8nXG4gIH0pO1xuXG4gIGNyZWF0ZUVwaXNvZGVJbmZvKGluZm9UYWIsIHBhcmFtcyk7XG4gIGNyZWF0ZVNob3dJbmZvKGluZm9UYWIsIHBhcmFtcyk7XG4gIGNyZWF0ZVNvY2lhbEFuZExpY2Vuc2VJbmZvKGluZm9UYWIsIHBhcmFtcyk7XG5cbiAgcmV0dXJuIGluZm9UYWI7XG59XG5cbi8qKlxuICogSW5mb3JtYXRpb24gbW9kdWxlIHRvIGRpc3BsYXkgcG9kY2FzdCBhbmQgZXBpc29kZSBpbmZvXG4gKiBAcGFyYW0ge29iamVjdH0gcGFyYW1zIHBhcmFtZXRlciBvYmplY3RcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBJbmZvKHBhcmFtcykge1xuICB0aGlzLnRhYiA9IGNyZWF0ZUluZm9UYWIocGFyYW1zKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBJbmZvO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL21vZHVsZXMvaW5mby5qc1wiLFwiL21vZHVsZXNcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciB0YyA9IHJlcXVpcmUoJy4uL3RpbWVjb2RlJyk7XG52YXIgY2FwID0gcmVxdWlyZSgnLi4vdXRpbCcpLmNhcDtcblxuZnVuY3Rpb24gcmVuZGVyVGltZUVsZW1lbnQoY2xhc3NOYW1lLCB0aW1lKSB7XG4gIHJldHVybiAkKCc8ZGl2IGNsYXNzPVwidGltZSB0aW1lLScgKyBjbGFzc05hbWUgKyAnXCI+JyArIHRpbWUgKyAnPC9kaXY+Jyk7XG59XG5cbi8qKlxuICogUmVuZGVyIGFuIEhUTUwgRWxlbWVudCBmb3IgdGhlIGN1cnJlbnQgY2hhcHRlclxuICogQHJldHVybnMge2pRdWVyeXxIVE1MRWxlbWVudH1cbiAqL1xuZnVuY3Rpb24gcmVuZGVyQ3VycmVudENoYXB0ZXJFbGVtZW50KCkge1xuICB2YXIgY2hhcHRlckVsZW1lbnQgPSAkKCc8ZGl2IGNsYXNzPVwiY2hhcHRlclwiPjwvZGl2PicpO1xuXG4gIGlmICghdGhpcy5jaGFwdGVyTW9kdWxlKSB7XG4gICAgcmV0dXJuIGNoYXB0ZXJFbGVtZW50O1xuICB9XG5cbiAgdmFyIGluZGV4ID0gdGhpcy5jaGFwdGVyTW9kdWxlLmN1cnJlbnRDaGFwdGVyO1xuICB2YXIgY2hhcHRlciA9IHRoaXMuY2hhcHRlck1vZHVsZS5jaGFwdGVyc1tpbmRleF07XG4gIGNvbnNvbGUuZGVidWcoJ1Byb2dyZXNzYmFyJywgJ3JlbmRlckN1cnJlbnRDaGFwdGVyRWxlbWVudCcsIGluZGV4LCBjaGFwdGVyKTtcblxuICB0aGlzLmNoYXB0ZXJCYWRnZSA9ICQoJzxzcGFuIGNsYXNzPVwiYmFkZ2VcIj4nICsgKGluZGV4ICsgMSkgKyAnPC9zcGFuPicpO1xuICB0aGlzLmNoYXB0ZXJUaXRsZSA9ICQoJzxzcGFuIGNsYXNzPVwiY2hhcHRlci10aXRsZVwiPicgKyBjaGFwdGVyLnRpdGxlICsgJzwvc3Bhbj4nKTtcblxuICBjaGFwdGVyRWxlbWVudFxuICAgIC5hcHBlbmQodGhpcy5jaGFwdGVyQmFkZ2UpXG4gICAgLmFwcGVuZCh0aGlzLmNoYXB0ZXJUaXRsZSk7XG5cbiAgcmV0dXJuIGNoYXB0ZXJFbGVtZW50O1xufVxuXG5mdW5jdGlvbiByZW5kZXJQcm9ncmVzc0luZm8ocHJvZ3Jlc3NCYXIpIHtcbiAgdmFyIHByb2dyZXNzSW5mbyA9ICQoJzxkaXYgY2xhc3M9XCJwcm9ncmVzcy1pbmZvXCI+PC9kaXY+Jyk7XG5cbiAgcmV0dXJuIHByb2dyZXNzSW5mb1xuICAgIC5hcHBlbmQocHJvZ3Jlc3NCYXIuY3VycmVudFRpbWUpXG4gICAgLmFwcGVuZChyZW5kZXJDdXJyZW50Q2hhcHRlckVsZW1lbnQuY2FsbChwcm9ncmVzc0JhcikpXG4gICAgLmFwcGVuZChwcm9ncmVzc0Jhci5kdXJhdGlvblRpbWVFbGVtZW50KTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlVGltZXMocHJvZ3Jlc3NCYXIpIHtcbiAgdmFyIHRpbWUgPSBwcm9ncmVzc0Jhci50aW1lbGluZS5nZXRUaW1lKCk7XG4gIHByb2dyZXNzQmFyLmN1cnJlbnRUaW1lLmh0bWwodGMuZnJvbVRpbWVTdGFtcCh0aW1lKSk7XG5cbiAgaWYgKHByb2dyZXNzQmFyLnNob3dEdXJhdGlvbikgeyByZXR1cm47IH1cblxuICB2YXIgcmVtYWluaW5nVGltZSA9IE1hdGguYWJzKHRpbWUgLSBwcm9ncmVzc0Jhci5kdXJhdGlvbik7XG4gIHByb2dyZXNzQmFyLmR1cmF0aW9uVGltZUVsZW1lbnQudGV4dCgnLScgKyB0Yy5mcm9tVGltZVN0YW1wKHJlbWFpbmluZ1RpbWUpKTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyRHVyYXRpb25UaW1lRWxlbWVudChwcm9ncmVzc0Jhcikge1xuICB2YXIgZm9ybWF0dGVkRHVyYXRpb24gPSB0Yy5mcm9tVGltZVN0YW1wKHByb2dyZXNzQmFyLmR1cmF0aW9uKTtcbiAgdmFyIGR1cmF0aW9uVGltZUVsZW1lbnQgPSByZW5kZXJUaW1lRWxlbWVudCgnZHVyYXRpb24nLCAwKTtcblxuICBkdXJhdGlvblRpbWVFbGVtZW50Lm9uKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICBwcm9ncmVzc0Jhci5zaG93RHVyYXRpb24gPSAhcHJvZ3Jlc3NCYXIuc2hvd0R1cmF0aW9uO1xuICAgIGlmIChwcm9ncmVzc0Jhci5zaG93RHVyYXRpb24pIHtcbiAgICAgIGR1cmF0aW9uVGltZUVsZW1lbnQudGV4dChmb3JtYXR0ZWREdXJhdGlvbik7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHVwZGF0ZVRpbWVzKHByb2dyZXNzQmFyKTtcbiAgfSk7XG5cbiAgcmV0dXJuIGR1cmF0aW9uVGltZUVsZW1lbnQ7XG59XG5cbmZ1bmN0aW9uIHJlbmRlck1hcmtlckF0KHRpbWUpIHtcbiAgdmFyIHBlcmNlbnQgPSAxMDAgKiB0aW1lIC8gdGhpcy5kdXJhdGlvbjtcbiAgcmV0dXJuICQoJzxkaXYgY2xhc3M9XCJtYXJrZXJcIiBzdHlsZT1cImxlZnQ6JyArIHBlcmNlbnQgKyAnJTtcIj48L2Rpdj4nKTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyQ2hhcHRlck1hcmtlcihjaGFwdGVyKSB7XG4gIHJldHVybiByZW5kZXJNYXJrZXJBdC5jYWxsKHRoaXMsIGNoYXB0ZXIuc3RhcnQpO1xufVxuXG4vKipcbiAqIFRoaXMgdXBkYXRlIG1ldGhvZCBpcyB0byBiZSBjYWxsZWQgd2hlbiBhIHBsYXllcnMgYGN1cnJlbnRUaW1lYCBjaGFuZ2VzLlxuICovXG5mdW5jdGlvbiB1cGRhdGUgKHRpbWVsaW5lKSB7XG4gIHRoaXMuc2V0UHJvZ3Jlc3ModGltZWxpbmUuZ2V0VGltZSgpKTtcbiAgdGhpcy5idWZmZXIudmFsKHRpbWVsaW5lLmdldEJ1ZmZlcmVkKCkpO1xuICB0aGlzLnNldENoYXB0ZXIoKTtcbn1cblxuLyoqXG4gKiBAY29uc3RydWN0b3JcbiAqIENyZWF0ZXMgYSBuZXcgcHJvZ3Jlc3MgYmFyIG9iamVjdC5cbiAqIEBwYXJhbSB7VGltZWxpbmV9IHRpbWVsaW5lIC0gVGhlIHBsYXllcnMgdGltZWxpbmUgdG8gYXR0YWNoIHRvLlxuICovXG5mdW5jdGlvbiBQcm9ncmVzc0Jhcih0aW1lbGluZSkge1xuICBpZiAoIXRpbWVsaW5lKSB7XG4gICAgY29uc29sZS5lcnJvcignVGltZWxpbmUgbWlzc2luZycsIGFyZ3VtZW50cyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHRoaXMudGltZWxpbmUgPSB0aW1lbGluZTtcbiAgdGhpcy5kdXJhdGlvbiA9IHRpbWVsaW5lLmR1cmF0aW9uO1xuXG4gIHRoaXMuYmFyID0gbnVsbDtcbiAgdGhpcy5jdXJyZW50VGltZSA9IG51bGw7XG5cbiAgaWYgKHRpbWVsaW5lLmhhc0NoYXB0ZXJzKSB7XG4gICAgLy8gRklYTUUgZ2V0IGFjY2VzcyB0byBjaGFwdGVyTW9kdWxlIHJlbGlhYmx5XG4gICAgLy8gdGhpcy50aW1lbGluZS5nZXRNb2R1bGUoJ2NoYXB0ZXJzJylcbiAgICB0aGlzLmNoYXB0ZXJNb2R1bGUgPSB0aGlzLnRpbWVsaW5lLm1vZHVsZXNbMF07XG4gICAgdGhpcy5jaGFwdGVyQmFkZ2UgPSBudWxsO1xuICAgIHRoaXMuY2hhcHRlclRpdGxlID0gbnVsbDtcbiAgfVxuXG4gIHRoaXMuc2hvd0R1cmF0aW9uID0gZmFsc2U7XG4gIHRoaXMucHJvZ3Jlc3MgPSBudWxsO1xuICB0aGlzLmJ1ZmZlciA9IG51bGw7XG4gIHRoaXMudXBkYXRlID0gdXBkYXRlLmJpbmQodGhpcyk7XG59XG5cblByb2dyZXNzQmFyLnByb3RvdHlwZS5zZXRIYW5kbGVQb3NpdGlvbiA9IGZ1bmN0aW9uICh0aW1lKSB7XG4gIHZhciBwZXJjZW50ID0gdGltZSAvIHRoaXMuZHVyYXRpb24gKiAxMDA7XG4gIHZhciBuZXdMZWZ0T2Zmc2V0ID0gcGVyY2VudCArICclJztcbiAgY29uc29sZS5kZWJ1ZygnUHJvZ3Jlc3NCYXInLCAnc2V0SGFuZGxlUG9zaXRpb24nLCAndGltZScsIHRpbWUsICduZXdMZWZ0T2Zmc2V0JywgbmV3TGVmdE9mZnNldCk7XG4gIHRoaXMuaGFuZGxlLmNzcygnbGVmdCcsIG5ld0xlZnRPZmZzZXQpO1xufTtcblxuLyoqXG4gKiBzZXQgcHJvZ3Jlc3MgYmFyIHZhbHVlLCBzbGlkZXIgcG9zaXRpb24gYW5kIGN1cnJlbnQgdGltZVxuICogQHBhcmFtIHtudW1iZXJ9IHRpbWVcbiAqL1xuUHJvZ3Jlc3NCYXIucHJvdG90eXBlLnNldFByb2dyZXNzID0gZnVuY3Rpb24gKHRpbWUpIHtcbiAgdGhpcy5wcm9ncmVzcy52YWwodGltZSk7XG4gIHRoaXMuc2V0SGFuZGxlUG9zaXRpb24odGltZSk7XG4gIHVwZGF0ZVRpbWVzKHRoaXMpO1xufTtcblxuLyoqXG4gKiBzZXQgY2hhcHRlciB0aXRsZSBhbmQgYmFkZ2VcbiAqL1xuUHJvZ3Jlc3NCYXIucHJvdG90eXBlLnNldENoYXB0ZXIgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICghdGhpcy5jaGFwdGVyTW9kdWxlKSB7IHJldHVybjsgfVxuXG4gIHZhciBpbmRleCA9IHRoaXMuY2hhcHRlck1vZHVsZS5jdXJyZW50Q2hhcHRlcjtcbiAgdmFyIGNoYXB0ZXIgPSB0aGlzLmNoYXB0ZXJNb2R1bGUuY2hhcHRlcnNbaW5kZXhdO1xuICB0aGlzLmNoYXB0ZXJCYWRnZS50ZXh0KGluZGV4ICsgMSk7XG4gIHRoaXMuY2hhcHRlclRpdGxlLnRleHQoY2hhcHRlci50aXRsZSk7XG59O1xuXG4vKipcbiAqIFJlbmRlcnMgYSBuZXcgcHJvZ3Jlc3MgYmFyIGpRdWVyeSBvYmplY3QuXG4gKi9cblByb2dyZXNzQmFyLnByb3RvdHlwZS5yZW5kZXIgPSBmdW5jdGlvbiAoKSB7XG5cbiAgLy8gdGltZSBlbGVtZW50c1xuICB2YXIgaW5pdGlhbFRpbWUgPSB0Yy5mcm9tVGltZVN0YW1wKHRoaXMudGltZWxpbmUuZ2V0VGltZSgpKTtcbiAgdGhpcy5jdXJyZW50VGltZSA9IHJlbmRlclRpbWVFbGVtZW50KCdjdXJyZW50JywgaW5pdGlhbFRpbWUpO1xuICB0aGlzLmR1cmF0aW9uVGltZUVsZW1lbnQgPSByZW5kZXJEdXJhdGlvblRpbWVFbGVtZW50KHRoaXMpO1xuXG4gIC8vIHByb2dyZXNzIGluZm9cbiAgdmFyIHByb2dyZXNzSW5mbyA9IHJlbmRlclByb2dyZXNzSW5mbyh0aGlzKTtcbiAgdXBkYXRlVGltZXModGhpcyk7XG5cbiAgLy8gdGltZWxpbmUgYW5kIGJ1ZmZlciBiYXJzXG4gIHZhciBwcm9ncmVzcyA9ICQoJzxkaXYgY2xhc3M9XCJwcm9ncmVzc1wiPjwvZGl2PicpO1xuICB2YXIgdGltZWxpbmVCYXIgPSAkKCc8cHJvZ3Jlc3MgY2xhc3M9XCJjdXJyZW50XCI+PC9wcm9ncmVzcz4nKVxuICAgICAgLmF0dHIoeyBtaW46IDAsIG1heDogdGhpcy5kdXJhdGlvbn0pO1xuICB2YXIgYnVmZmVyID0gJCgnPHByb2dyZXNzIGNsYXNzPVwiYnVmZmVyXCI+PC9wcm9ncmVzcz4nKVxuICAgICAgLmF0dHIoe21pbjogMCwgbWF4OiB0aGlzLmR1cmF0aW9ufSk7XG4gIHZhciBoYW5kbGUgPSAkKCc8ZGl2IGNsYXNzPVwiaGFuZGxlXCI+PGRpdiBjbGFzcz1cImlubmVyLWhhbmRsZVwiPjwvZGl2PjwvZGl2PicpO1xuXG4gIHByb2dyZXNzXG4gICAgLmFwcGVuZCh0aW1lbGluZUJhcilcbiAgICAuYXBwZW5kKGJ1ZmZlcilcbiAgICAuYXBwZW5kKGhhbmRsZSk7XG5cbiAgdGhpcy5wcm9ncmVzcyA9IHRpbWVsaW5lQmFyO1xuICB0aGlzLmJ1ZmZlciA9IGJ1ZmZlcjtcbiAgdGhpcy5oYW5kbGUgPSBoYW5kbGU7XG4gIHRoaXMuc2V0UHJvZ3Jlc3ModGhpcy50aW1lbGluZS5nZXRUaW1lKCkpO1xuXG4gIGlmICh0aGlzLmNoYXB0ZXJNb2R1bGUpIHtcbiAgICB2YXIgY2hhcHRlck1hcmtlcnMgPSB0aGlzLmNoYXB0ZXJNb2R1bGUuY2hhcHRlcnMubWFwKHJlbmRlckNoYXB0ZXJNYXJrZXIsIHRoaXMpO1xuICAgIGNoYXB0ZXJNYXJrZXJzLnNoaWZ0KCk7IC8vIHJlbW92ZSBmaXJzdCBvbmVcbiAgICBwcm9ncmVzcy5hcHBlbmQoY2hhcHRlck1hcmtlcnMpO1xuICB9XG5cbiAgLy8gcHJvZ3Jlc3MgYmFyXG4gIHZhciBiYXIgPSAkKCc8ZGl2IGNsYXNzPVwicHJvZ3Jlc3NiYXJcIj48L2Rpdj4nKTtcbiAgYmFyXG4gICAgLmFwcGVuZChwcm9ncmVzc0luZm8pXG4gICAgLmFwcGVuZChwcm9ncmVzcyk7XG5cbiAgdGhpcy5iYXIgPSBiYXI7XG4gIHJldHVybiBiYXI7XG59O1xuXG5Qcm9ncmVzc0Jhci5wcm90b3R5cGUuYWRkRXZlbnRzID0gZnVuY3Rpb24oKSB7XG4gIHZhciBtb3VzZUlzRG93biA9IGZhbHNlO1xuICB2YXIgdGltZWxpbmUgPSB0aGlzLnRpbWVsaW5lO1xuICB2YXIgcHJvZ3Jlc3MgPSB0aGlzLnByb2dyZXNzO1xuXG4gIGZ1bmN0aW9uIGNhbGN1bGF0ZU5ld1RpbWUgKHBhZ2VYKSB7XG4gICAgLy8gbW91c2UgcG9zaXRpb24gcmVsYXRpdmUgdG8gdGhlIG9iamVjdFxuICAgIHZhciB3aWR0aCA9IHByb2dyZXNzLm91dGVyV2lkdGgodHJ1ZSk7XG4gICAgdmFyIG9mZnNldCA9IHByb2dyZXNzLm9mZnNldCgpO1xuICAgIHZhciBwb3MgPSBjYXAocGFnZVggLSBvZmZzZXQubGVmdCwgMCwgd2lkdGgpO1xuICAgIHZhciBwZXJjZW50YWdlID0gKHBvcyAvIHdpZHRoKTtcbiAgICByZXR1cm4gcGVyY2VudGFnZSAqIHRpbWVsaW5lLmR1cmF0aW9uO1xuICB9XG5cbiAgZnVuY3Rpb24gaGFuZGxlTW91c2VNb3ZlIChldmVudCkge1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cbiAgICB2YXIgeCA9IGV2ZW50LnBhZ2VYO1xuICAgIGlmIChldmVudC5vcmlnaW5hbEV2ZW50LmNoYW5nZWRUb3VjaGVzKSB7XG4gICAgICB4ID0gZXZlbnQub3JpZ2luYWxFdmVudC5jaGFuZ2VkVG91Y2hlc1swXS5wYWdlWDtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHRpbWVsaW5lLmR1cmF0aW9uICE9PSAnbnVtYmVyJyB8fCAhbW91c2VJc0Rvd24gKSB7IHJldHVybjsgfVxuICAgIHZhciBuZXdUaW1lID0gY2FsY3VsYXRlTmV3VGltZSh4KTtcbiAgICBpZiAobmV3VGltZSA9PT0gdGltZWxpbmUuZ2V0VGltZSgpKSB7IHJldHVybjsgfVxuICAgIHRpbWVsaW5lLnNlZWsobmV3VGltZSk7XG4gIH1cblxuICBmdW5jdGlvbiBoYW5kbGVNb3VzZVVwICgpIHtcbiAgICBtb3VzZUlzRG93biA9IGZhbHNlO1xuICAgIHRpbWVsaW5lLnNlZWtFbmQoKTtcbiAgICAkKGRvY3VtZW50KS51bmJpbmQoJ3RvdWNoZW5kLmR1ciBtb3VzZXVwLmR1ciB0b3VjaG1vdmUuZHVyIG1vdXNlbW92ZS5kdXInKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGhhbmRsZU1vdXNlRG93biAoZXZlbnQpIHtcbiAgICBpZiAoZXZlbnQud2hpY2ggIT09IDAgJiYgZXZlbnQud2hpY2ggIT09IDEpIHsgcmV0dXJuOyB9XG5cbiAgICBtb3VzZUlzRG93biA9IHRydWU7XG4gICAgaGFuZGxlTW91c2VNb3ZlKGV2ZW50KTtcbiAgICB0aW1lbGluZS5zZWVrU3RhcnQoKTtcbiAgICAkKGRvY3VtZW50KVxuICAgICAgLmJpbmQoJ21vdXNlbW92ZS5kdXIgdG91Y2htb3ZlLmR1cicsIGhhbmRsZU1vdXNlTW92ZSlcbiAgICAgIC5iaW5kKCdtb3VzZXVwLmR1ciB0b3VjaGVuZC5kdXInLCBoYW5kbGVNb3VzZVVwKTtcbiAgfVxuXG4gIC8vIGhhbmRsZSBjbGljayBhbmQgZHJhZyB3aXRoIG1vdXNlIG9yIHRvdWNoIGluIHByb2dyZXNzYmFyIGFuZCBvbiBoYW5kbGVcbiAgdGhpcy5wcm9ncmVzcy5iaW5kKCdtb3VzZWRvd24gdG91Y2hzdGFydCcsIGhhbmRsZU1vdXNlRG93bik7XG5cbiAgdGhpcy5oYW5kbGUuYmluZCgndG91Y2hzdGFydCBtb3VzZWRvd24nLCBoYW5kbGVNb3VzZURvd24pO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQcm9ncmVzc0JhcjtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9tb2R1bGVzL3Byb2dyZXNzYmFyLmpzXCIsXCIvbW9kdWxlc1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBTYXZpbmcgdGhlIHBsYXl0aW1lXG4gKi9cbnZhciBwcmVmaXggPSAncG9kbG92ZS13ZWItcGxheWVyLXBsYXl0aW1lLSc7XG5cbmZ1bmN0aW9uIGdldEl0ZW0gKCkge1xuICByZXR1cm4gK2xvY2FsU3RvcmFnZVt0aGlzLmtleV07XG59XG5cbmZ1bmN0aW9uIHJlbW92ZUl0ZW0gKCkge1xuICByZXR1cm4gbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0odGhpcy5rZXkpO1xufVxuXG5mdW5jdGlvbiBoYXNJdGVtICgpIHtcbiAgcmV0dXJuICh0aGlzLmtleSkgaW4gbG9jYWxTdG9yYWdlO1xufVxuXG5mdW5jdGlvbiB1cGRhdGUgKCkge1xuICBjb25zb2xlLmRlYnVnKCdTYXZlVGltZScsICd1cGRhdGUnLCB0aGlzLnRpbWVsaW5lLmdldFRpbWUoKSk7XG4gIGlmICh0aGlzLnRpbWVsaW5lLmdldFRpbWUoKSA9PT0gMCkge1xuICAgIHJldHVybiByZW1vdmVJdGVtLmNhbGwodGhpcyk7XG4gIH1cbiAgdGhpcy5zZXRJdGVtKHRoaXMudGltZWxpbmUuZ2V0VGltZSgpKTtcbn1cblxuZnVuY3Rpb24gU2F2ZVRpbWUodGltZWxpbmUsIHBhcmFtcykge1xuICB0aGlzLnRpbWVsaW5lID0gdGltZWxpbmU7XG4gIHRoaXMua2V5ID0gcHJlZml4ICsgcGFyYW1zLnBlcm1hbGluaztcbiAgdGhpcy5nZXRJdGVtID0gZ2V0SXRlbS5iaW5kKHRoaXMpO1xuICB0aGlzLnJlbW92ZUl0ZW0gPSByZW1vdmVJdGVtLmJpbmQodGhpcyk7XG4gIHRoaXMuaGFzSXRlbSA9IGhhc0l0ZW0uYmluZCh0aGlzKTtcbiAgdGhpcy51cGRhdGUgPSB1cGRhdGUuYmluZCh0aGlzKTtcblxuICAvLyBzZXQgdGhlIHRpbWUgb24gc3RhcnRcbiAgaWYgKHRoaXMuaGFzSXRlbSgpKSB7XG4gICAgdGltZWxpbmUuc2V0VGltZSh0aGlzLmdldEl0ZW0oKSk7XG4gIH1cbn1cblxuU2F2ZVRpbWUucHJvdG90eXBlLnNldEl0ZW0gPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgbG9jYWxTdG9yYWdlW3RoaXMua2V5XSA9IHZhbHVlO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTYXZlVGltZTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9tb2R1bGVzL3NhdmV0aW1lLmpzXCIsXCIvbW9kdWxlc1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIFRhYiA9IHJlcXVpcmUoJy4uL3RhYicpXG4gICwgU29jaWFsQnV0dG9uTGlzdCA9IHJlcXVpcmUoJy4uL3NvY2lhbC1idXR0b24tbGlzdCcpO1xuXG52YXIgc2VydmljZXMgPSBbJ3R3aXR0ZXInLCAnZmFjZWJvb2snLCAnZ3BsdXMnLCAndHVtYmxyJywgJ2VtYWlsJ11cbiAgLCBzaGFyZU9wdGlvbnMgPSBbXG4gICAge25hbWU6ICdTaG93JywgdmFsdWU6ICdzaG93J30sXG4gICAge25hbWU6ICdFcGlzb2RlJywgdmFsdWU6ICdlcGlzb2RlJywgZGVmYXVsdDogdHJ1ZX0sXG4gICAge25hbWU6ICdDaGFwdGVyJywgdmFsdWU6ICdjaGFwdGVyJywgZGlzYWJsZWQ6IHRydWV9LFxuICAgIHtuYW1lOiAnRXhhY3RseSB0aGlzIHBhcnQgaGVyZScsIHZhbHVlOiAndGltZWQnLCBkaXNhYmxlZDogdHJ1ZX1cbiAgXVxuICAsIHNoYXJlRGF0YSA9IHt9O1xuXG4vLyBtb2R1bGUgZ2xvYmFsc1xudmFyIHNlbGVjdGVkT3B0aW9uLCBzaGFyZUJ1dHRvbnMsIGxpbmtJbnB1dDtcblxuZnVuY3Rpb24gZ2V0U2hhcmVEYXRhKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSA9PT0gJ3Nob3cnKSB7XG4gICAgcmV0dXJuIHNoYXJlRGF0YS5zaG93O1xuICB9XG4gIHZhciBkYXRhID0gc2hhcmVEYXRhLmVwaXNvZGU7XG4gIC8vIHRvZG8gYWRkIGNoYXB0ZXIgc3RhcnQgYW5kIGVuZCB0aW1lIHRvIHVybFxuICAvL2lmICh2YWx1ZSA9PT0gJ2NoYXB0ZXInKSB7XG4gIC8vfVxuICAvLyB0b2RvIGFkZCBzZWxlY3RlZCBzdGFydCBhbmQgZW5kIHRpbWUgdG8gdXJsXG4gIC8vaWYgKHZhbHVlID09PSAndGltZWQnKSB7XG4gIC8vfVxuICByZXR1cm4gZGF0YTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlVXJscyhkYXRhKSB7XG4gIHNoYXJlQnV0dG9ucy51cGRhdGUoZGF0YSk7XG4gIGxpbmtJbnB1dC51cGRhdGUoZGF0YSk7XG59XG5cbmZ1bmN0aW9uIG9uU2hhcmVPcHRpb25DaGFuZ2VUbyAoZWxlbWVudCwgdmFsdWUpIHtcbiAgdmFyIGRhdGEgPSBnZXRTaGFyZURhdGEodmFsdWUpO1xuXG4gIHJldHVybiBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICBjb25zb2xlLmxvZygnc2hhcmluZyBvcHRpb25zIGNoYW5nZWQnLCB2YWx1ZSk7XG4gICAgc2VsZWN0ZWRPcHRpb24ucmVtb3ZlQ2xhc3MoJ3NlbGVjdGVkJyk7XG4gICAgZWxlbWVudC5hZGRDbGFzcygnc2VsZWN0ZWQnKTtcbiAgICBzZWxlY3RlZE9wdGlvbiA9IGVsZW1lbnQ7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB1cGRhdGVVcmxzKGRhdGEpO1xuICB9O1xufVxuXG4vKipcbiAqIENyZWF0ZSBodG1sIGZvciBhbiBwb3N0ZXIgaW1hZ2VcbiAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlICdlcGlzb2RlJyBvciAnc2hvdydcbiAqIEByZXR1cm5zIHtzdHJpbmd9IEhUTUwgZm9yIHRoZSBpbWFnZVxuICovXG5mdW5jdGlvbiBjcmVhdGVQb3N0ZXJGb3IodHlwZSkge1xuICB2YXIgZGF0YSA9IHNoYXJlRGF0YVt0eXBlXTtcbiAgaWYgKCF0eXBlIHx8ICFkYXRhIHx8ICFkYXRhLnBvc3Rlcikge1xuICAgIGNvbnNvbGUud2FybignY2Fubm90IGNyZWF0ZSBwb3N0ZXIgZm9yJywgdHlwZSk7XG4gICAgcmV0dXJuICcnO1xuICB9XG4gIGNvbnNvbGUubG9nKCdjcmVhdGUgcG9zdGVyIGZvcicsIHR5cGUsICcgPiB1cmwnLCBkYXRhLnBvc3Rlcik7XG4gIHJldHVybiAnPGltZyBzcmM9XCInICsgZGF0YS5wb3N0ZXIgKyAnXCIgZGF0YS1pbWc9XCInICsgZGF0YS5wb3N0ZXIgKyAnXCIgYWx0PVwiUG9zdGVyIEltYWdlXCI+Jztcbn1cblxuLyoqXG4gKiBjcmVhdGUgc2hhcmluZyBidXR0b25cbiAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb24gc2hhcmluZyBvcHRpb24gZGVmaW5pdGlvblxuICogQHJldHVybnMge2pRdWVyeX0gc2hhcmUgYnV0dG9uIHJlZmVyZW5jZVxuICovXG5mdW5jdGlvbiBjcmVhdGVPcHRpb24ob3B0aW9uKSB7XG4gIGlmIChvcHRpb24uZGlzYWJsZWQpIHtcbiAgICBjb25zb2xlLmxvZygnU2hhcmUnLCAnY3JlYXRlT3B0aW9uJywgJ29taXQgZGlzYWJsZWQgb3B0aW9uJywgb3B0aW9uLm5hbWUpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmFyIGRhdGEgPSBnZXRTaGFyZURhdGEob3B0aW9uLnZhbHVlKTtcblxuICBpZiAoIWRhdGEpIHtcbiAgICBjb25zb2xlLmxvZygnU2hhcmUnLCAnY3JlYXRlT3B0aW9uJywgJ29taXQgb3B0aW9uIHdpdGhvdXQgZGF0YScsIG9wdGlvbi5uYW1lKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZhciBlbGVtZW50ID0gJCgnPGRpdiBjbGFzcz1cInNoYXJlLXNlbGVjdC1vcHRpb25cIj4nICsgY3JlYXRlUG9zdGVyRm9yKG9wdGlvbi52YWx1ZSkgK1xuICAgICAgJzxzcGFuPlNoYXJlIHRoaXMgJyArIG9wdGlvbi5uYW1lICsgJzwvc3Bhbj4nICtcbiAgICAnPC9kaXY+Jyk7XG5cbiAgaWYgKG9wdGlvbi5kZWZhdWx0KSB7XG4gICAgc2VsZWN0ZWRPcHRpb24gPSBlbGVtZW50O1xuICAgIGVsZW1lbnQuYWRkQ2xhc3MoJ3NlbGVjdGVkJyk7XG4gICAgdXBkYXRlVXJscyhkYXRhKTtcbiAgfVxuICBlbGVtZW50Lm9uKCdjbGljaycsIG9uU2hhcmVPcHRpb25DaGFuZ2VUbyhlbGVtZW50LCBvcHRpb24udmFsdWUpKTtcbiAgcmV0dXJuIGVsZW1lbnQ7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBodG1sIGRpdiBlbGVtZW50IHRvIHdyYXAgYWxsIHNoYXJlIGJ1dHRvbnNcbiAqIEByZXR1cm5zIHtqUXVlcnl8SFRNTEVsZW1lbnR9IHNoYXJlIGJ1dHRvbiB3cmFwcGVyIHJlZmVyZW5jZVxuICovXG5mdW5jdGlvbiBjcmVhdGVTaGFyZUJ1dHRvbldyYXBwZXIoKSB7XG4gIHZhciBkaXYgPSAkKCc8ZGl2IGNsYXNzPVwic2hhcmUtYnV0dG9uLXdyYXBwZXJcIj48L2Rpdj4nKTtcbiAgZGl2LmFwcGVuZChzaGFyZU9wdGlvbnMubWFwKGNyZWF0ZU9wdGlvbikpO1xuXG4gIHJldHVybiBkaXY7XG59XG5cbi8qKlxuICogY3JlYXRlIHNoYXJpbmcgYnV0dG9ucyBpbiBhIGZvcm1cbiAqIEByZXR1cm5zIHtqUXVlcnl9IGZvcm0gZWxlbWVudCByZWZlcmVuY2VcbiAqL1xuZnVuY3Rpb24gY3JlYXRlU2hhcmVPcHRpb25zKCkge1xuICB2YXIgZm9ybSA9ICQoJzxmb3JtPicgK1xuICAgICc8bGVnZW5kPldoYXQgd291bGQgeW91IGxpa2UgdG8gc2hhcmU/PC9sZWdlbmQ+JyArXG4gICc8L2Zvcm0+Jyk7XG4gIGZvcm0uYXBwZW5kKGNyZWF0ZVNoYXJlQnV0dG9uV3JhcHBlcik7XG4gIHJldHVybiBmb3JtO1xufVxuXG4vKipcbiAqIGJ1aWxkIGFuZCByZXR1cm4gdGFiIGluc3RhbmNlIGZvciBzaGFyaW5nXG4gKiBAcGFyYW0ge29iamVjdH0gcGFyYW1zIHBsYXllciBjb25maWd1cmF0aW9uXG4gKiBAcmV0dXJucyB7bnVsbHxUYWJ9IHNoYXJpbmcgdGFiIGluc3RhbmNlIG9yIG51bGwgaWYgcGVybWFsaW5rIG1pc3Npbmcgb3Igc2hhcmluZyBkaXNhYmxlZFxuICovXG5mdW5jdGlvbiBjcmVhdGVTaGFyZVRhYihwYXJhbXMpIHtcbiAgaWYgKCFwYXJhbXMucGVybWFsaW5rIHx8IHBhcmFtcy5oaWRlc2hhcmVidXR0b24gPT09IHRydWUpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZhciBzaGFyZVRhYiA9IG5ldyBUYWIoe1xuICAgIGljb246ICdwd3Atc2hhcmUnLFxuICAgIHRpdGxlOiAnU2hvdy9oaWRlIHNoYXJpbmcgdGFicycsXG4gICAgbmFtZTogJ3BvZGxvdmV3ZWJwbGF5ZXJfc2hhcmUnLFxuICAgIGhlYWRsaW5lOiAnU2hhcmUnXG4gIH0pO1xuXG4gIHNoYXJlQnV0dG9ucyA9IG5ldyBTb2NpYWxCdXR0b25MaXN0KHNlcnZpY2VzLCBnZXRTaGFyZURhdGEoJ2VwaXNvZGUnKSk7XG4gIGxpbmtJbnB1dCA9ICQoJzxoMz5MaW5rPC9oMz4nICtcbiAgICAnPGlucHV0IHR5cGU9XCJ1cmxcIiBuYW1lPVwic2hhcmUtbGluay11cmxcIiByZWFkb25seT4nKTtcbiAgbGlua0lucHV0LnVwZGF0ZSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICB0aGlzLnZhbChkYXRhLnJhd1VybCk7XG4gIH07XG5cbiAgc2hhcmVUYWIuY3JlYXRlTWFpbkNvbnRlbnQoJycpLmFwcGVuZChjcmVhdGVTaGFyZU9wdGlvbnMoKSk7XG4gIHNoYXJlVGFiLmNyZWF0ZUZvb3RlcignPGgzPlNoYXJlIHZpYSAuLi48L2gzPicpLmFwcGVuZChzaGFyZUJ1dHRvbnMubGlzdCkuYXBwZW5kKGxpbmtJbnB1dCk7XG5cbiAgcmV0dXJuIHNoYXJlVGFiO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIFNoYXJlKHBhcmFtcykge1xuICBzaGFyZURhdGEuZXBpc29kZSA9IHtcbiAgICBwb3N0ZXI6IHBhcmFtcy5wb3N0ZXIsXG4gICAgdGl0bGU6IGVuY29kZVVSSUNvbXBvbmVudChwYXJhbXMudGl0bGUpLFxuICAgIHVybDogZW5jb2RlVVJJQ29tcG9uZW50KHBhcmFtcy5wZXJtYWxpbmspLFxuICAgIHJhd1VybDogcGFyYW1zLnBlcm1hbGluayxcbiAgICB0ZXh0OiBlbmNvZGVVUklDb21wb25lbnQocGFyYW1zLnRpdGxlICsgJyAnICsgcGFyYW1zLnBlcm1hbGluaylcbiAgfTtcbiAgc2hhcmVEYXRhLmNoYXB0ZXJzID0gcGFyYW1zLmNoYXB0ZXJzO1xuXG4gIGlmIChwYXJhbXMuc2hvdy51cmwpIHtcbiAgICBzaGFyZURhdGEuc2hvdyA9IHtcbiAgICAgIHBvc3RlcjogcGFyYW1zLnNob3cucG9zdGVyLFxuICAgICAgdGl0bGU6IGVuY29kZVVSSUNvbXBvbmVudChwYXJhbXMuc2hvdy50aXRsZSksXG4gICAgICB1cmw6IGVuY29kZVVSSUNvbXBvbmVudChwYXJhbXMuc2hvdy51cmwpLFxuICAgICAgcmF3VXJsOiBwYXJhbXMuc2hvdy51cmwsXG4gICAgICB0ZXh0OiBlbmNvZGVVUklDb21wb25lbnQocGFyYW1zLnNob3cudGl0bGUgKyAnICcgKyBwYXJhbXMuc2hvdy51cmwpXG4gICAgfTtcbiAgfVxuXG4gIHNlbGVjdGVkT3B0aW9uID0gJ2VwaXNvZGUnO1xuICB0aGlzLnRhYiA9IGNyZWF0ZVNoYXJlVGFiKHBhcmFtcyk7XG59O1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL21vZHVsZXMvc2hhcmUuanNcIixcIi9tb2R1bGVzXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgZW1iZWQgPSByZXF1aXJlKCcuL2VtYmVkJyksXG4gIHBhcnNlVGltZWNvZGUgPSByZXF1aXJlKCcuL3RpbWVjb2RlJykucGFyc2U7XG5cbi8qKlxuICogcGxheWVyXG4gKi9cbnZhclxuLy8gS2VlcCBhbGwgUGxheWVycyBvbiBzaXRlIC0gZm9yIGlubGluZSBwbGF5ZXJzXG4vLyBlbWJlZGRlZCBwbGF5ZXJzIGFyZSByZWdpc3RlcmVkIGluIHBvZGxvdmUtd2VicGxheWVyLW1vZGVyYXRvciBpbiB0aGUgZW1iZWRkaW5nIHBhZ2VcbiAgcGxheWVycyA9IFtdLFxuLy8gYWxsIHVzZWQgZnVuY3Rpb25zXG4gIG1lanNvcHRpb25zID0ge1xuICAgIGRlZmF1bHRWaWRlb1dpZHRoOiA0ODAsXG4gICAgZGVmYXVsdFZpZGVvSGVpZ2h0OiAyNzAsXG4gICAgdmlkZW9XaWR0aDogLTEsXG4gICAgdmlkZW9IZWlnaHQ6IC0xLFxuICAgIGF1ZGlvV2lkdGg6IC0xLFxuICAgIGF1ZGlvSGVpZ2h0OiAzMCxcbiAgICBzdGFydFZvbHVtZTogMC44LFxuICAgIGxvb3A6IGZhbHNlLFxuICAgIGVuYWJsZUF1dG9zaXplOiB0cnVlLFxuICAgIGZlYXR1cmVzOiBbJ3BsYXlwYXVzZScsICdjdXJyZW50JywgJ3Byb2dyZXNzJywgJ2R1cmF0aW9uJywgJ3RyYWNrcycsICdmdWxsc2NyZWVuJ10sXG4gICAgYWx3YXlzU2hvd0NvbnRyb2xzOiBmYWxzZSxcbiAgICBpUGFkVXNlTmF0aXZlQ29udHJvbHM6IGZhbHNlLFxuICAgIGlQaG9uZVVzZU5hdGl2ZUNvbnRyb2xzOiBmYWxzZSxcbiAgICBBbmRyb2lkVXNlTmF0aXZlQ29udHJvbHM6IGZhbHNlLFxuICAgIGFsd2F5c1Nob3dIb3VyczogZmFsc2UsXG4gICAgc2hvd1RpbWVjb2RlRnJhbWVDb3VudDogZmFsc2UsXG4gICAgZnJhbWVzUGVyU2Vjb25kOiAyNSxcbiAgICBlbmFibGVLZXlib2FyZDogdHJ1ZSxcbiAgICBwYXVzZU90aGVyUGxheWVyczogdHJ1ZSxcbiAgICBkdXJhdGlvbjogZmFsc2UsXG4gICAgcGx1Z2luczogWydmbGFzaCcsICdzaWx2ZXJsaWdodCddLFxuICAgIHBsdWdpblBhdGg6ICcuL2Jpbi8nLFxuICAgIGZsYXNoTmFtZTogJ2ZsYXNobWVkaWFlbGVtZW50LnN3ZicsXG4gICAgc2lsdmVybGlnaHROYW1lOiAnc2lsdmVybGlnaHRtZWRpYWVsZW1lbnQueGFwJ1xuICB9LFxuICBkZWZhdWx0cyA9IHtcbiAgICBjaGFwdGVybGlua3M6ICdhbGwnLFxuICAgIHdpZHRoOiAnMTAwJScsXG4gICAgZHVyYXRpb246IGZhbHNlLFxuICAgIGNoYXB0ZXJzVmlzaWJsZTogZmFsc2UsXG4gICAgdGltZWNvbnRyb2xzVmlzaWJsZTogZmFsc2UsXG4gICAgc2hhcmVidXR0b25zVmlzaWJsZTogZmFsc2UsXG4gICAgZG93bmxvYWRidXR0b25zVmlzaWJsZTogZmFsc2UsXG4gICAgc3VtbWFyeVZpc2libGU6IGZhbHNlLFxuICAgIGhpZGV0aW1lYnV0dG9uOiBmYWxzZSxcbiAgICBoaWRlZG93bmxvYWRidXR0b246IGZhbHNlLFxuICAgIGhpZGVzaGFyZWJ1dHRvbjogZmFsc2UsXG4gICAgc2hhcmV3aG9sZWVwaXNvZGU6IGZhbHNlLFxuICAgIHNvdXJjZXM6IFtdXG4gIH07XG5cbi8qKlxuICogcmVtb3ZlICdweCcgdW5pdCwgc2V0IHdpdGR0aCB0byAxMDAlIGZvciAnYXV0bydcbiAqIEBwYXJhbSB7c3RyaW5nfSB3aWR0aFxuICogQHJldHVybnMge3N0cmluZ31cbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplV2lkdGgod2lkdGgpIHtcbiAgaWYgKHdpZHRoLnRvTG93ZXJDYXNlKCkgPT09ICdhdXRvJykge1xuICAgIHJldHVybiAnMTAwJSc7XG4gIH1cbiAgcmV0dXJuIHdpZHRoLnJlcGxhY2UoJ3B4JywgJycpO1xufVxuXG4vKipcbiAqIGF1ZGlvIG9yIHZpZGVvIHRhZ1xuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcGxheWVyXG4gKiBAcmV0dXJucyB7c3RyaW5nfSAnYXVkaW8nIHwgJ3ZpZGVvJ1xuICovXG5mdW5jdGlvbiBnZXRQbGF5ZXJUeXBlIChwbGF5ZXIpIHtcbiAgcmV0dXJuIHBsYXllci50YWdOYW1lLnRvTG93ZXJDYXNlKCk7XG59XG5cbi8qKlxuICoga2lsbCBwbGF5L3BhdXNlIGJ1dHRvbiBmcm9tIG1pbmlwbGF5ZXJcbiAqIEBwYXJhbSBvcHRpb25zXG4gKi9cbmZ1bmN0aW9uIHJlbW92ZVBsYXlQYXVzZShvcHRpb25zKSB7XG4gICQuZWFjaChvcHRpb25zLmZlYXR1cmVzLCBmdW5jdGlvbiAoaSkge1xuICAgIGlmICh0aGlzID09PSAncGxheXBhdXNlJykge1xuICAgICAgb3B0aW9ucy5mZWF0dXJlcy5zcGxpY2UoaSwgMSk7XG4gICAgfVxuICB9KTtcbn1cblxuLyoqXG4gKiBwbGF5ZXIgZXJyb3IgaGFuZGxpbmcgZnVuY3Rpb25cbiAqIHdpbGwgcmVtb3ZlIHRoZSB0b3Btb3N0IG1lZGlhZmlsZSBmcm9tIHNyYyBvciBzb3VyY2UgbGlzdFxuICogcG9zc2libGUgZml4IGZvciBGaXJlZm94IEFBQyBpc3N1ZXNcbiAqL1xuZnVuY3Rpb24gcmVtb3ZlVW5wbGF5YWJsZU1lZGlhKCkge1xuICB2YXIgJHRoaXMgPSAkKHRoaXMpO1xuICBpZiAoJHRoaXMuYXR0cignc3JjJykpIHtcbiAgICAkdGhpcy5yZW1vdmVBdHRyKCdzcmMnKTtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIHNvdXJjZUxpc3QgPSAkdGhpcy5jaGlsZHJlbignc291cmNlJyk7XG4gIGlmIChzb3VyY2VMaXN0Lmxlbmd0aCkge1xuICAgIHNvdXJjZUxpc3QuZmlyc3QoKS5yZW1vdmUoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGUocGxheWVyLCBwYXJhbXMsIGNhbGxiYWNrKSB7XG4gIHZhciBqcVBsYXllcixcbiAgICBwbGF5ZXJUeXBlID0gZ2V0UGxheWVyVHlwZShwbGF5ZXIpLFxuICAgIHNlY0FycmF5LFxuICAgIHdyYXBwZXI7XG5cbiAganFQbGF5ZXIgPSAkKHBsYXllcik7XG4gIHdyYXBwZXIgPSAkKCc8ZGl2IGNsYXNzPVwiY29udGFpbmVyXCI+PC9kaXY+Jyk7XG4gIGpxUGxheWVyLnJlcGxhY2VXaXRoKHdyYXBwZXIpO1xuXG4gIC8vZmluZSB0dW5pbmcgcGFyYW1zXG4gIHBhcmFtcy53aWR0aCA9IG5vcm1hbGl6ZVdpZHRoKHBhcmFtcy53aWR0aCk7XG4gIGlmIChwbGF5ZXJUeXBlID09PSAnYXVkaW8nKSB7XG4gICAgLy8gRklYTUU6IFNpbmNlIHRoZSBwbGF5ZXIgaXMgbm8gbG9uZ2VyIHZpc2libGUgaXQgaGFzIG5vIHdpZHRoXG4gICAgaWYgKHBhcmFtcy5hdWRpb1dpZHRoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHBhcmFtcy53aWR0aCA9IHBhcmFtcy5hdWRpb1dpZHRoO1xuICAgIH1cbiAgICBtZWpzb3B0aW9ucy5hdWRpb1dpZHRoID0gcGFyYW1zLndpZHRoO1xuICAgIC8va2lsbCBmdWxsc2NyZWVuIGJ1dHRvblxuICAgICQuZWFjaChtZWpzb3B0aW9ucy5mZWF0dXJlcywgZnVuY3Rpb24gKGkpIHtcbiAgICAgIGlmICh0aGlzID09PSAnZnVsbHNjcmVlbicpIHtcbiAgICAgICAgbWVqc29wdGlvbnMuZmVhdHVyZXMuc3BsaWNlKGksIDEpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJlbW92ZVBsYXlQYXVzZShtZWpzb3B0aW9ucyk7XG4gIH1cbiAgZWxzZSBpZiAocGxheWVyVHlwZSA9PT0gJ3ZpZGVvJykge1xuICAgIC8vdmlkZW8gcGFyYW1zXG4gICAgaWYgKGZhbHNlICYmIHBhcmFtcy5oZWlnaHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbWVqc29wdGlvbnMudmlkZW9XaWR0aCA9IHBhcmFtcy53aWR0aDtcbiAgICAgIG1lanNvcHRpb25zLnZpZGVvSGVpZ2h0ID0gcGFyYW1zLmhlaWdodDtcbiAgICB9XG4gICAgLy8gRklYTUVcbiAgICBpZiAoZmFsc2UgJiYgJChwbGF5ZXIpLmF0dHIoJ3dpZHRoJykgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcGFyYW1zLndpZHRoID0gJChwbGF5ZXIpLmF0dHIoJ3dpZHRoJyk7XG4gICAgfVxuICB9XG5cbiAgLy9kdXJhdGlvbiBjYW4gYmUgZ2l2ZW4gaW4gc2Vjb25kcyBvciBpbiBOUFQgZm9ybWF0XG4gIGlmIChwYXJhbXMuZHVyYXRpb24gJiYgcGFyYW1zLmR1cmF0aW9uICE9PSBwYXJzZUludChwYXJhbXMuZHVyYXRpb24sIDEwKSkge1xuICAgIHNlY0FycmF5ID0gcGFyc2VUaW1lY29kZShwYXJhbXMuZHVyYXRpb24pO1xuICAgIHBhcmFtcy5kdXJhdGlvbiA9IHNlY0FycmF5WzBdO1xuICB9XG5cbiAgLy9PdmVyd3JpdGUgTUVKUyBkZWZhdWx0IHZhbHVlcyB3aXRoIGFjdHVhbCBkYXRhXG4gICQuZWFjaChtZWpzb3B0aW9ucywgZnVuY3Rpb24gKGtleSkge1xuICAgIGlmIChrZXkgaW4gcGFyYW1zKSB7XG4gICAgICBtZWpzb3B0aW9uc1trZXldID0gcGFyYW1zW2tleV07XG4gICAgfVxuICB9KTtcblxuICAvL3dyYXBwZXIgYW5kIGluaXQgc3R1ZmZcbiAgLy8gRklYTUU6IGJldHRlciBjaGVjayBmb3IgbnVtZXJpY2FsIHZhbHVlXG4gIGlmIChwYXJhbXMud2lkdGgudG9TdHJpbmcoKS50cmltKCkgPT09IHBhcnNlSW50KHBhcmFtcy53aWR0aCwgMTApLnRvU3RyaW5nKCkpIHtcbiAgICBwYXJhbXMud2lkdGggPSBwYXJzZUludChwYXJhbXMud2lkdGgsIDEwKSArICdweCc7XG4gIH1cblxuICBwbGF5ZXJzLnB1c2gocGxheWVyKTtcblxuICAvL2FkZCBwYXJhbXMgZnJvbSBhdWRpbyBhbmQgdmlkZW8gZWxlbWVudHNcbiAganFQbGF5ZXIuZmluZCgnc291cmNlJykuZWFjaChmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCFwYXJhbXMuc291cmNlcykge1xuICAgICAgcGFyYW1zLnNvdXJjZXMgPSBbXTtcbiAgICB9XG4gICAgcGFyYW1zLnNvdXJjZXMucHVzaCgkKHRoaXMpLmF0dHIoJ3NyYycpKTtcbiAgfSk7XG5cbiAgcGFyYW1zLnR5cGUgPSBwbGF5ZXJUeXBlO1xuICAvLyBpbml0IE1FSlMgdG8gcGxheWVyXG4gIG1lanNvcHRpb25zLnN1Y2Nlc3MgPSBmdW5jdGlvbiAocGxheWVyRWxlbWVudCkge1xuICAgIGpxUGxheWVyLm9uKCdlcnJvcicsIHJlbW92ZVVucGxheWFibGVNZWRpYSk7ICAgLy8gVGhpcyBtaWdodCBiZSBhIGZpeCB0byBzb21lIEZpcmVmb3ggQUFDIGlzc3Vlcy5cbiAgICBjYWxsYmFjayhwbGF5ZXJFbGVtZW50LCBwYXJhbXMsIHdyYXBwZXIpO1xuICB9O1xuICB2YXIgbWUgPSBuZXcgTWVkaWFFbGVtZW50KHBsYXllciwgbWVqc29wdGlvbnMpO1xuICBjb25zb2xlLmxvZygnTWVkaWFFbGVtZW50JywgbWUpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgY3JlYXRlOiBjcmVhdGUsXG4gIGRlZmF1bHRzOiBkZWZhdWx0cyxcbiAgcGxheWVyczogcGxheWVyc1xufTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9wbGF5ZXIuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBzb2NpYWxOZXR3b3JrcyA9IHJlcXVpcmUoJy4vc29jaWFsLW5ldHdvcmtzJyk7XG5cbmZ1bmN0aW9uIGNyZWF0ZUJ1dHRvbldpdGgob3B0aW9ucykge1xuICByZXR1cm4gZnVuY3Rpb24gKHNlcnZpY2VOYW1lKSB7XG4gICAgdmFyIHNlcnZpY2UgPSBzb2NpYWxOZXR3b3Jrcy5nZXQoc2VydmljZU5hbWUpO1xuICAgIHJldHVybiBzZXJ2aWNlLmdldEJ1dHRvbihvcHRpb25zKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gU29jaWFsQnV0dG9uTGlzdCAoc2VydmljZXMsIG9wdGlvbnMpIHtcbiAgdmFyIGNyZWF0ZUJ1dHRvbiA9IGNyZWF0ZUJ1dHRvbldpdGgob3B0aW9ucyk7XG4gIHRoaXMuYnV0dG9ucyA9IHNlcnZpY2VzLm1hcChjcmVhdGVCdXR0b24pO1xuXG4gIHRoaXMubGlzdCA9ICQoJzx1bD48L3VsPicpO1xuICB0aGlzLmJ1dHRvbnMuZm9yRWFjaChmdW5jdGlvbiAoYnV0dG9uKSB7XG4gICAgdmFyIGxpc3RFbGVtZW50ID0gJCgnPGxpPjwvbGk+JykuYXBwZW5kKGJ1dHRvbi5lbGVtZW50KTtcbiAgICB0aGlzLmxpc3QuYXBwZW5kKGxpc3RFbGVtZW50KTtcbiAgfSwgdGhpcyk7XG59XG5cblNvY2lhbEJ1dHRvbkxpc3QucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIHRoaXMuYnV0dG9ucy5mb3JFYWNoKGZ1bmN0aW9uIChidXR0b24pIHtcbiAgICBidXR0b24udXBkYXRlVXJsKG9wdGlvbnMpO1xuICB9KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU29jaWFsQnV0dG9uTGlzdDtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9zb2NpYWwtYnV0dG9uLWxpc3QuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGNyZWF0ZUJ1dHRvbiAob3B0aW9ucykge1xuICByZXR1cm4gJCgnPGEgY2xhc3M9XCJwd3AtY29udHJhc3QtJyArIG9wdGlvbnMuaWNvbiArICdcIiB0YXJnZXQ9XCJfYmxhbmtcIiBocmVmPVwiJyArIG9wdGlvbnMudXJsICsgJ1wiICcgK1xuICAndGl0bGU9XCInICsgb3B0aW9ucy50aXRsZSArICdcIj48aSBjbGFzcz1cImljb24gcHdwLScgKyBvcHRpb25zLmljb24gKyAnXCI+PC9pPjwvYT4nICtcbiAgJzxzcGFuPicgKyBvcHRpb25zLnRpdGxlICsgJzwvc3Bhbj4nKTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGFuIG9iamVjdCB0byBpbnRlcmFjdCB3aXRoIGEgc29jaWFsIG5ldHdvcmtcbiAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zIEljb24sIHRpdGxlIHByb2ZpbGUtIGFuZCBzaGFyaW5nLVVSTC10ZW1wbGF0ZXNcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBTb2NpYWxOZXR3b3JrIChvcHRpb25zKSB7XG4gIHRoaXMuaWNvbiA9IG9wdGlvbnMuaWNvbjtcbiAgdGhpcy50aXRsZSA9IG9wdGlvbnMudGl0bGU7XG4gIHRoaXMudXJsID0gb3B0aW9ucy5wcm9maWxlVXJsO1xuICB0aGlzLnNoYXJlVXJsID0gb3B0aW9ucy5zaGFyZVVybDtcbn1cblxuLyoqXG4gKiBidWlsZCBVUkwgZm9yIHNoYXJpbmcgYSB0ZXh0LCBhIHRpdGxlIGFuZCBhIHVybFxuICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgY29udGVudHMgdG8gYmUgc2hhcmVkXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBVUkwgdG8gc2hhcmUgdGhlIGNvbnRlbnRzXG4gKi9cblNvY2lhbE5ldHdvcmsucHJvdG90eXBlLmdldFNoYXJlVXJsID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgdmFyIHNoYXJlVXJsID0gdGhpcy5zaGFyZVVybFxuICAgIC5yZXBsYWNlKCckdGV4dCQnLCBvcHRpb25zLnRleHQpXG4gICAgLnJlcGxhY2UoJyR0aXRsZSQnLCBvcHRpb25zLnRpdGxlKVxuICAgIC5yZXBsYWNlKCckdXJsJCcsIG9wdGlvbnMudXJsKTtcbiAgcmV0dXJuIHRoaXMudXJsICsgc2hhcmVVcmw7XG59O1xuXG4vKipcbiAqIGJ1aWxkIFVSTCB0byBhIGdpdmVuIHByb2ZpbGVcbiAqIEBwYXJhbSB7b2JqZWN0fSBwcm9maWxlIFVzZXJuYW1lIHRvIGxpbmsgdG9cbiAqIEByZXR1cm5zIHtzdHJpbmd9IHByb2ZpbGUgVVJMXG4gKi9cblNvY2lhbE5ldHdvcmsucHJvdG90eXBlLmdldFByb2ZpbGVVcmwgPSBmdW5jdGlvbiAocHJvZmlsZSkge1xuICByZXR1cm4gdGhpcy51cmwgKyBwcm9maWxlO1xufTtcblxuLyoqXG4gKiBnZXQgcHJvZmlsZSBidXR0b24gZWxlbWVudFxuICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgb3B0aW9ucy5wcm9maWxlIGRlZmluZXMgdGhlIHByb2ZpbGUgdGhlIGJ1dHRvbiBsaW5rcyB0b1xuICogQHJldHVybnMge3tlbGVtZW50OntqUXVlcnl9fX0gYnV0dG9uIHJlZmVyZW5jZVxuICovXG5Tb2NpYWxOZXR3b3JrLnByb3RvdHlwZS5nZXRQcm9maWxlQnV0dG9uID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgaWYgKCFvcHRpb25zLnByb2ZpbGUpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICByZXR1cm4ge1xuICAgIGVsZW1lbnQ6IGNyZWF0ZUJ1dHRvbih7XG4gICAgICB1cmw6IHRoaXMuZ2V0UHJvZmlsZVVybChvcHRpb25zLnByb2ZpbGUpLFxuICAgICAgdGl0bGU6IHRoaXMudGl0bGUsXG4gICAgICBpY29uOiB0aGlzLmljb25cbiAgICB9KVxuICB9O1xufTtcblxuLyoqXG4gKiBnZXQgc2hhcmUgYnV0dG9uIGVsZW1lbnQgYW5kIFVSTCB1cGRhdGUgZnVuY3Rpb25cbiAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zIGluaXRpYWwgY29udGVudHMgdG8gYmUgc2hhcmVkIHdpdGggdGhlIGJ1dHRvblxuICogQHJldHVybnMge3tlbGVtZW50OntqUXVlcnl9LCB1cGRhdGVVcmw6e2Z1bmN0aW9ufX19IGJ1dHRvbiByZWZlcmVuY2UgYW5kIHVwZGF0ZSBmdW5jdGlvblxuICovXG5Tb2NpYWxOZXR3b3JrLnByb3RvdHlwZS5nZXRTaGFyZUJ1dHRvbiA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG5cbiAgaWYgKCF0aGlzLnNoYXJlVXJsIHx8ICFvcHRpb25zLnRpdGxlIHx8ICFvcHRpb25zLnVybCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgaWYgKCFvcHRpb25zLnRleHQpIHtcbiAgICBvcHRpb25zLnRleHQgPSBvcHRpb25zLnRpdGxlICsgJyUyMCcgKyBvcHRpb25zLnVybDtcbiAgfVxuXG4gIHZhciBlbGVtZW50ID0gY3JlYXRlQnV0dG9uKHtcbiAgICB1cmw6IHRoaXMuZ2V0U2hhcmVVcmwob3B0aW9ucyksXG4gICAgdGl0bGU6IHRoaXMudGl0bGUsXG4gICAgaWNvbjogdGhpcy5pY29uXG4gIH0pO1xuXG4gIHZhciB1cGRhdGVVcmwgPSBmdW5jdGlvbiAodXBkYXRlT3B0aW9ucykge1xuICAgIGVsZW1lbnQuZ2V0KDApLmhyZWYgPSB0aGlzLmdldFNoYXJlVXJsKHVwZGF0ZU9wdGlvbnMpO1xuICB9LmJpbmQodGhpcyk7XG5cbiAgcmV0dXJuIHtcbiAgICBlbGVtZW50OiBlbGVtZW50LFxuICAgIHVwZGF0ZVVybDogdXBkYXRlVXJsXG4gIH07XG59O1xuXG4vKipcbiAqIGdldCBzaGFyZSBvciBwcm9maWxlIGJ1dHRvbiBkZXBlbmRpbmcgb24gdGhlIG9wdGlvbnMgZ2l2ZW5cbiAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zIG9iamVjdCB3aXRoIGVpdGhlciBwcm9maWxlbmFtZSBvciBjb250ZW50cyB0byBzaGFyZVxuICogQHJldHVybnMge29iamVjdH0gYnV0dG9uIG9iamVjdFxuICovXG5Tb2NpYWxOZXR3b3JrLnByb3RvdHlwZS5nZXRCdXR0b24gPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICBpZiAob3B0aW9ucy5wcm9maWxlKSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0UHJvZmlsZUJ1dHRvbihvcHRpb25zKTtcbiAgfVxuICBpZiAodGhpcy5zaGFyZVVybCAmJiBvcHRpb25zLnRpdGxlICYmIG9wdGlvbnMudXJsKSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0U2hhcmVCdXR0b24ob3B0aW9ucyk7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNvY2lhbE5ldHdvcms7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvc29jaWFsLW5ldHdvcmsuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBTb2NpYWxOZXR3b3JrID0gcmVxdWlyZSgnLi9zb2NpYWwtbmV0d29yaycpO1xudmFyIHNvY2lhbE5ldHdvcmtzID0ge1xuICB0d2l0dGVyOiBuZXcgU29jaWFsTmV0d29yayh7XG4gICAgaWNvbjogJ3R3aXR0ZXInLFxuICAgIHRpdGxlOiAnVHdpdHRlcicsXG4gICAgcHJvZmlsZVVybDogJ2h0dHBzOi8vdHdpdHRlci5jb20vJyxcbiAgICBzaGFyZVVybDogJ3NoYXJlP3RleHQ9JHRleHQkJnVybD0kdXJsJCdcbiAgfSksXG5cbiAgZmxhdHRyOiBuZXcgU29jaWFsTmV0d29yayh7XG4gICAgaWNvbjogJ2ZsYXR0cicsXG4gICAgdGl0bGU6ICdGbGF0dHInLFxuICAgIHByb2ZpbGVVcmw6ICdodHRwczovL2ZsYXR0ci5jb20vcHJvZmlsZS8nLFxuICAgIHNoYXJlVXJsOiAnc2hhcmU/dGV4dD0kdGV4dCQmdXJsPSR1cmwkJ1xuICB9KSxcblxuICBmYWNlYm9vazogbmV3IFNvY2lhbE5ldHdvcmsoe1xuICAgIGljb246ICdmYWNlYm9vaycsXG4gICAgdGl0bGU6ICdGYWNlYm9vaycsXG4gICAgcHJvZmlsZVVybDogJ2h0dHBzOi8vZmFjZWJvb2suY29tLycsXG4gICAgc2hhcmVVcmw6ICdzaGFyZS5waHA/dD0kdGV4dCQmdT0kdXJsJCdcbiAgfSksXG5cbiAgYWRuOiBuZXcgU29jaWFsTmV0d29yayh7XG4gICAgaWNvbjogJ2FkbicsXG4gICAgdGl0bGU6ICdBcHAubmV0JyxcbiAgICBwcm9maWxlVXJsOiAnaHR0cHM6Ly9hbHBoYS5hcHAubmV0LycsXG4gICAgc2hhcmVVcmw6ICdpbnRlbnQvcG9zdD90ZXh0PSR0ZXh0JCdcbiAgfSksXG5cbiAgc291bmRjbG91ZDogbmV3IFNvY2lhbE5ldHdvcmsoe1xuICAgIGljb246ICdzb3VuZGNsb3VkJyxcbiAgICB0aXRsZTogJ1NvdW5kQ2xvdWQnLFxuICAgIHByb2ZpbGVVcmw6ICdodHRwczovL3NvdW5kY2xvdWQuY29tLycsXG4gICAgc2hhcmVVcmw6ICdzaGFyZT90aXRsZT0kdGl0bGUkJnVybD0kdXJsJCdcbiAgfSksXG5cbiAgaW5zdGFncmFtOiBuZXcgU29jaWFsTmV0d29yayh7XG4gICAgaWNvbjogJ2luc3RhZ3JhbScsXG4gICAgdGl0bGU6ICdJbnN0YWdyYW0nLFxuICAgIHByb2ZpbGVVcmw6ICdodHRwOi8vaW5zdGFncmFtLmNvbS8nLFxuICAgIHNoYXJlVXJsOiAnc2hhcmU/dGl0bGU9JHRpdGxlJCZ1cmw9JHVybCQnXG4gIH0pLFxuXG4gIHR1bWJscjogbmV3IFNvY2lhbE5ldHdvcmsoe1xuICAgIGljb246ICd0dW1ibHInLFxuICAgIHRpdGxlOiAnVHVtYmxyJyxcbiAgICBwcm9maWxlVXJsOiAnaHR0cHM6Ly93d3cudHVtYmxyLmNvbS8nLFxuICAgIHNoYXJlVXJsOiAnc2hhcmU/dGl0bGU9JHRpdGxlJCZ1cmw9JHVybCQnXG4gIH0pLFxuXG4gIGVtYWlsOiBuZXcgU29jaWFsTmV0d29yayh7XG4gICAgaWNvbjogJ21lc3NhZ2UnLFxuICAgIHRpdGxlOiAnRS1NYWlsJyxcbiAgICBwcm9maWxlVXJsOiAnbWFpbHRvOicsXG4gICAgc2hhcmVVcmw6ICc/c3ViamVjdD0kdGl0bGUkJmJvZHk9JHRleHQkJ1xuICB9KSxcbiAgZ3BsdXM6IG5ldyBTb2NpYWxOZXR3b3JrKHtcbiAgICBpY29uOiAnZ29vZ2xlLXBsdXMnLFxuICAgIHRpdGxlOiAnR29vZ2xlKycsXG4gICAgcHJvZmlsZVVybDogJ2h0dHBzOi8vcGx1cy5nb29nbGUuY29tLycsXG4gICAgc2hhcmVVcmw6ICdzaGFyZT90aXRsZT0kdGl0bGUkJnVybD0kdXJsJCdcbiAgfSlcbn07XG5cbi8qKlxuICogcmV0dXJucyB0aGUgc2VydmljZSByZWdpc3RlcmVkIHdpdGggdGhlIGdpdmVuIG5hbWVcbiAqIEBwYXJhbSB7c3RyaW5nfSBzZXJ2aWNlTmFtZSBUaGUgbmFtZSBvZiB0aGUgc29jaWFsIG5ldHdvcmtcbiAqIEByZXR1cm5zIHtTb2NpYWxOZXR3b3JrfSBUaGUgbmV0d29yayB3aXRoIHRoZSBnaXZlbiBuYW1lXG4gKi9cbmZ1bmN0aW9uIGdldFNlcnZpY2UgKHNlcnZpY2VOYW1lKSB7XG4gIHZhciBzZXJ2aWNlID0gc29jaWFsTmV0d29ya3Nbc2VydmljZU5hbWVdO1xuICBpZiAoIXNlcnZpY2UpIHtcbiAgICBjb25zb2xlLmVycm9yKCdVbmtub3duIHNlcnZpY2UnLCBzZXJ2aWNlTmFtZSk7XG4gIH1cbiAgcmV0dXJuIHNlcnZpY2U7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBnZXQ6IGdldFNlcnZpY2Vcbn07XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvc29jaWFsLW5ldHdvcmtzLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIFdoZW4gdGFiIGNvbnRlbnQgaXMgc2Nyb2xsZWQsIGEgYm94c2hhZG93IGlzIGFkZGVkIHRvIHRoZSBoZWFkZXJcbiAqIEBwYXJhbSBldmVudFxuICovXG5mdW5jdGlvbiBhZGRTaGFkb3dPblNjcm9sbChldmVudCkge1xuICB2YXIgc2Nyb2xsID0gZXZlbnQuY3VycmVudFRhcmdldC5zY3JvbGxUb3A7XG4gIGV2ZW50LmRhdGEuaGVhZGVyLnRvZ2dsZUNsYXNzKCdzY3JvbGxlZCcsIChzY3JvbGwgPj0gNSApKTtcbn1cblxuLyoqXG4gKiBSZXR1cm4gYW4gaHRtbCBzZWN0aW9uIGVsZW1lbnQgYXMgYSB3cmFwcGVyIGZvciB0aGUgdGFiXG4gKiBAcGFyYW0ge29iamVjdH0gb3B0aW9uc1xuICogQHJldHVybnMgeyp8alF1ZXJ5fEhUTUxFbGVtZW50fVxuICovXG5mdW5jdGlvbiBjcmVhdGVDb250ZW50Qm94KG9wdGlvbnMpIHtcbiAgdmFyIGNsYXNzZXMgPSBbJ3RhYiddO1xuICBjbGFzc2VzLnB1c2gob3B0aW9ucy5uYW1lKTtcbiAgaWYgKG9wdGlvbnMuYWN0aXZlKSB7XG4gICAgY2xhc3Nlcy5wdXNoKCdhY3RpdmUnKTtcbiAgfVxuICByZXR1cm4gJCgnPHNlY3Rpb24gY2xhc3M9XCInICsgY2xhc3Nlcy5qb2luKCcgJykgKyAnXCI+PC9zZWN0aW9uPicpO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIHRhYlxuICogQHBhcmFtIG9wdGlvbnNcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBUYWIob3B0aW9ucykge1xuICB0aGlzLmljb24gPSBvcHRpb25zLmljb247XG4gIHRoaXMudGl0bGUgPSBvcHRpb25zLnRpdGxlO1xuICB0aGlzLmhlYWRsaW5lID0gb3B0aW9ucy5oZWFkbGluZTtcblxuICB0aGlzLmJveCA9IGNyZWF0ZUNvbnRlbnRCb3gob3B0aW9ucyk7XG4gIHZhciBoZWFkZXIgPSB0aGlzLmNyZWF0ZUhlYWRlcigpO1xuICB0aGlzLmJveC5vbignc2Nyb2xsJywge2hlYWRlcjogaGVhZGVyfSwgYWRkU2hhZG93T25TY3JvbGwpO1xuXG4gIHRoaXMuYWN0aXZlID0gZmFsc2U7XG4gIHRoaXMudG9nZ2xlID0gbnVsbDtcbn1cblxuLyoqXG4gKiBBZGQgY2xhc3MgJ2FjdGl2ZScgdG8gdGhlIGFjdGl2ZSB0YWJcbiAqL1xuVGFiLnByb3RvdHlwZS5vcGVuID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLmFjdGl2ZSA9IHRydWU7XG4gIHRoaXMuYm94LmFkZENsYXNzKCdhY3RpdmUnKTtcbiAgdGhpcy50b2dnbGUuYWRkQ2xhc3MoJ2FjdGl2ZScpO1xufTtcblxuLyoqXG4gKiBSZW1vdmUgY2xhc3MgJ2FjdGl2ZScgZnJvbSB0aGUgaW5hY3RpdmUgdGFiXG4gKi9cblRhYi5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuYWN0aXZlID0gZmFsc2U7XG4gIHRoaXMuYm94LnJlbW92ZUNsYXNzKCdhY3RpdmUnKTtcbiAgdGhpcy50b2dnbGUucmVtb3ZlQ2xhc3MoJ2FjdGl2ZScpO1xufTtcblxuLyoqXG4gKiBSZXR1cm4gYW4gaHRtbCBoZWFkZXIgZWxlbWVudCB3aXRoIGEgaGVhZGxpbmVcbiAqL1xuVGFiLnByb3RvdHlwZS5jcmVhdGVIZWFkZXIgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGhlYWRlciA9ICQoJzxoZWFkZXIgY2xhc3M9XCJ0YWItaGVhZGVyXCI+PGgyIGNsYXNzPVwidGFiLWhlYWRsaW5lXCI+JyArXG4gICAgJzxpIGNsYXNzPVwiaWNvbiAnICsgdGhpcy5pY29uICsgJ1wiPjwvaT4nICsgdGhpcy5oZWFkbGluZSArICc8L2gyPjwvaGVhZGVyPicpO1xuICB0aGlzLmJveC5hcHBlbmQoaGVhZGVyKTtcbiAgcmV0dXJuIGhlYWRlcjtcbn07XG5cbi8qKlxuICogQXBwZW5kIGFuIGh0bWwgZGl2IGVsZW1lbnQgd2l0aCBjbGFzcyBtYWluIHRvIHRoZSB0YWIncyBjb250ZW50IGJveFxuICogQHBhcmFtIGNvbnRlbnRcbiAqL1xuVGFiLnByb3RvdHlwZS5jcmVhdGVNYWluQ29udGVudCA9IGZ1bmN0aW9uKGNvbnRlbnQpIHtcbiAgdmFyIG1haW5EaXYgPSAkKCc8ZGl2IGNsYXNzPVwibWFpblwiPicgKyBjb250ZW50ICsgJzwvZGl2Jyk7XG4gIHRoaXMuYm94LmFwcGVuZChtYWluRGl2KTtcbiAgcmV0dXJuIG1haW5EaXY7XG59O1xuXG4vKipcbiAqIEFwcGVuZCBhbiBodG1sIGFzaWRlIGVsZW1lbnQgdG8gdGhlIHRhYidzIGNvbnRlbnQgYm94XG4gKiBAcGFyYW0gY29udGVudFxuICovXG5UYWIucHJvdG90eXBlLmNyZWF0ZUFzaWRlID0gZnVuY3Rpb24oY29udGVudCkge1xuICB2YXIgYXNpZGUgPSAkKCc8YXNpZGUgY2xhc3M9XCJhc2lkZVwiPicgKyBjb250ZW50ICsgJzwvYXNpZGU+Jyk7XG4gIHRoaXMuYm94LmFwcGVuZChhc2lkZSk7XG4gIHJldHVybiBhc2lkZTtcbn07XG5cbi8qKlxuICogQXBwZW5kIGFuIGh0bWwgZm9vdGVyIGVsZW1lbnQgdG8gdGhlIHRhYidzIGNvbnRlbnQgYm94XG4gKiBAcGFyYW0gY29udGVudFxuICovXG5UYWIucHJvdG90eXBlLmNyZWF0ZUZvb3RlciA9IGZ1bmN0aW9uKGNvbnRlbnQpIHtcbiAgdmFyIGZvb3RlciA9ICQoJzxmb290ZXI+JyArIGNvbnRlbnQgKyAnPC9mb290ZXI+Jyk7XG4gIHRoaXMuYm94LmFwcGVuZChmb290ZXIpO1xuICByZXR1cm4gZm9vdGVyO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBUYWI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvdGFiLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEB0eXBlIHtUYWJ9XG4gKi9cbnZhciBUYWIgPSByZXF1aXJlKCcuL3RhYi5qcycpO1xuXG4vKipcbiAqXG4gKiBAcGFyYW0ge1RhYn0gdGFiXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuZnVuY3Rpb24gZ2V0VG9nZ2xlQ2xpY2tIYW5kbGVyKHRhYikge1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICBjb25zb2xlLmRlYnVnKCdUYWJSZWdpc3RyeScsICdhY3RpdmVUYWInLCB0aGlzLmFjdGl2ZVRhYik7XG4gIGlmICh0aGlzLmFjdGl2ZVRhYikge1xuICAgIHRoaXMuYWN0aXZlVGFiLmNsb3NlKCk7XG4gIH1cbiAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSB0YWIpIHtcbiAgICB0aGlzLmFjdGl2ZVRhYiA9IG51bGw7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHRoaXMuYWN0aXZlVGFiID0gdGFiO1xuICB0aGlzLmFjdGl2ZVRhYi5vcGVuKCk7XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcGxheWVyXG4gKi9cbmZ1bmN0aW9uIGxvZ0N1cnJlbnRUaW1lIChwbGF5ZXIpIHtcbiAgY29uc29sZS5sb2coJ3BsYXllci5jdXJyZW50VGltZScsIHBsYXllci5jdXJyZW50VGltZSk7XG59XG5cbmZ1bmN0aW9uIFRhYlJlZ2lzdHJ5KCkge1xuICAvKipcbiAgICogd2lsbCBzdG9yZSBhIHJlZmVyZW5jZSB0byBjdXJyZW50bHkgYWN0aXZlIHRhYiBpbnN0YW5jZSB0byBjbG9zZSBpdCB3aGVuIGFub3RoZXIgb25lIGlzIG9wZW5lZFxuICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgKi9cbiAgdGhpcy5hY3RpdmVUYWIgPSBudWxsO1xuICB0aGlzLnRvZ2dsZWJhciA9ICQoJzxkaXYgY2xhc3M9XCJ0b2dnbGViYXIgYmFyXCI+PC9kaXY+Jyk7XG4gIHRoaXMudG9nZ2xlTGlzdCA9ICQoJzx1bCBjbGFzcz1cInRhYmxpc3RcIj48L3VsPicpO1xuICB0aGlzLnRvZ2dsZWJhci5hcHBlbmQodGhpcy50b2dnbGVMaXN0KTtcbiAgdGhpcy5jb250YWluZXIgPSAkKCc8ZGl2IGNsYXNzPVwidGFic1wiPjwvZGl2PicpO1xuICB0aGlzLmxpc3RlbmVycyA9IFtsb2dDdXJyZW50VGltZV07XG4gIHRoaXMudGFicyA9IFtdO1xufVxuXG5UYWJSZWdpc3RyeS5wcm90b3R5cGUuY3JlYXRlVG9nZ2xlRm9yID0gZnVuY3Rpb24gKHRhYikge1xuICB2YXIgdG9nZ2xlID0gJCgnPGxpIHRpdGxlPVwiJyArIHRhYi50aXRsZSArICdcIj4nICtcbiAgICAgICc8YSBocmVmPVwiamF2YXNjcmlwdDo7XCIgY2xhc3M9XCJidXR0b24gYnV0dG9uLXRvZ2dsZSAnICsgdGFiLmljb24gKyAnXCI+PC9hPicgK1xuICAgICc8L2xpPicpO1xuICB0b2dnbGUub24oJ2NsaWNrJywgZ2V0VG9nZ2xlQ2xpY2tIYW5kbGVyLmJpbmQodGhpcywgdGFiKSk7XG4gIHRoaXMudG9nZ2xlTGlzdC5hcHBlbmQodG9nZ2xlKTtcbiAgcmV0dXJuIHRvZ2dsZTtcbn07XG5cbi8qKlxuICogUmVnaXN0ZXIgYSB0YWIgYW5kIG9wZW4gaXQgaWYgaXQgaXMgaW5pdGlhbGx5IHZpc2libGVcbiAqIEBwYXJhbSB7VGFifSB0YWJcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gdmlzaWJsZVxuICovXG5UYWJSZWdpc3RyeS5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24odGFiKSB7XG4gIGlmICh0YWIgPT09IG51bGwpIHsgcmV0dXJuOyB9XG4gIHRoaXMudGFicy5wdXNoKHRhYik7XG4gIHRoaXMuY29udGFpbmVyLmFwcGVuZCh0YWIuYm94KTtcbiAgdGFiLnRvZ2dsZSA9IHRoaXMuY3JlYXRlVG9nZ2xlRm9yKHRhYik7XG59O1xuXG5UYWJSZWdpc3RyeS5wcm90b3R5cGUub3BlbkluaXRpYWwgPSBmdW5jdGlvbiAodGFiTmFtZSkge1xuICB2YXIgbWF0Y2hpbmdUYWJzID0gdGhpcy50YWJzLmZpbHRlcihmdW5jdGlvbiAodGFiKSB7XG4gICAgcmV0dXJuICh0YWIuaGVhZGxpbmUgPT09IHRhYk5hbWUpO1xuICB9KTtcbiAgaWYgKG1hdGNoaW5nVGFicy5sZW5ndGggPiAwKSB7XG4gICAgbWF0Y2hpbmdUYWJzLnBvcCgpLm9wZW4oKTtcbiAgfVxufTtcblxuLyoqXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IG1vZHVsZVxuICovXG5UYWJSZWdpc3RyeS5wcm90b3R5cGUuYWRkTW9kdWxlID0gZnVuY3Rpb24obW9kdWxlKSB7XG4gIGlmIChtb2R1bGUudGFiKSB7XG4gICAgdGhpcy5hZGQobW9kdWxlLnRhYik7XG4gIH1cbiAgaWYgKG1vZHVsZS51cGRhdGUpIHtcbiAgICB0aGlzLmxpc3RlbmVycy5wdXNoKG1vZHVsZS51cGRhdGUpO1xuICB9XG59O1xuXG5UYWJSZWdpc3RyeS5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgY29uc29sZS5sb2coJ1RhYlJlZ2lzdHJ5I3VwZGF0ZScsIGV2ZW50KTtcbiAgdmFyIHBsYXllciA9IGV2ZW50LmN1cnJlbnRUYXJnZXQ7XG4gICQuZWFjaCh0aGlzLmxpc3RlbmVycywgZnVuY3Rpb24gKGksIGxpc3RlbmVyKSB7IGxpc3RlbmVyKHBsYXllcik7IH0pO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBUYWJSZWdpc3RyeTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi90YWJyZWdpc3RyeS5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIHplcm9GaWxsID0gcmVxdWlyZSgnLi91dGlsJykuemVyb0ZpbGw7XG5cbi8qKlxuICogVGltZWNvZGUgYXMgZGVzY3JpYmVkIGluIGh0dHA6Ly9wb2Rsb3ZlLm9yZy9kZWVwLWxpbmsvXG4gKiBhbmQgaHR0cDovL3d3dy53My5vcmcvVFIvbWVkaWEtZnJhZ3MvI2ZyYWdtZW50LWRpbWVuc2lvbnNcbiAqL1xudmFyIHRpbWVDb2RlTWF0Y2hlciA9IC8oPzooXFxkKyk6KT8oXFxkezEsMn0pOihcXGRcXGQpKFxcLlxcZHsxLDN9KT8vO1xuXG4vKipcbiAqIGNvbnZlcnQgYW4gYXJyYXkgb2Ygc3RyaW5nIHRvIHRpbWVjb2RlXG4gKiBAcGFyYW0ge3N0cmluZ30gdGNcbiAqIEByZXR1cm5zIHtudW1iZXJ8Ym9vbGVhbn1cbiAqL1xuZnVuY3Rpb24gZXh0cmFjdFRpbWUodGMpIHtcbiAgaWYgKCF0Yykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2YXIgcGFydHMgPSB0aW1lQ29kZU1hdGNoZXIuZXhlYyh0Yyk7XG4gIGlmICghcGFydHMpIHtcbiAgICBjb25zb2xlLndhcm4oJ0NvdWxkIG5vdCBleHRyYWN0IHRpbWUgZnJvbScsIHRjKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdmFyIHRpbWUgPSAwO1xuICAvLyBob3Vyc1xuICB0aW1lICs9IHBhcnRzWzFdID8gcGFyc2VJbnQocGFydHNbMV0sIDEwKSAqIDYwICogNjAgOiAwO1xuICAvLyBtaW51dGVzXG4gIHRpbWUgKz0gcGFyc2VJbnQocGFydHNbMl0sIDEwKSAqIDYwO1xuICAvLyBzZWNvbmRzXG4gIHRpbWUgKz0gcGFyc2VJbnQocGFydHNbM10sIDEwKTtcbiAgLy8gbWlsbGlzZWNvbmRzXG4gIHRpbWUgKz0gcGFydHNbNF0gPyBwYXJzZUZsb2F0KHBhcnRzWzRdKSA6IDA7XG4gIC8vIG5vIG5lZ2F0aXZlIHRpbWVcbiAgdGltZSA9IE1hdGgubWF4KHRpbWUsIDApO1xuICByZXR1cm4gdGltZTtcbn1cblxuLyoqXG4gKiBjb252ZXJ0IGEgdGltZXN0YW1wIHRvIGEgdGltZWNvZGUgaW4gJHtpbnNlcnQgUkZDIGhlcmV9IGZvcm1hdFxuICogQHBhcmFtIHtOdW1iZXJ9IHRpbWVcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gbGVhZGluZ1plcm9zXG4gKiBAcGFyYW0ge0Jvb2xlYW59IFtmb3JjZUhvdXJzXSBmb3JjZSBvdXRwdXQgb2YgaG91cnMsIGRlZmF1bHRzIHRvIGZhbHNlXG4gKiBAcGFyYW0ge0Jvb2xlYW59IFtzaG93TWlsbGlzXSBvdXRwdXQgbWlsbGlzZWNvbmRzIHNlcGFyYXRlZCB3aXRoIGEgZG90IGZyb20gdGhlIHNlY29uZHMgLSBkZWZhdWx0cyB0byBmYWxzZVxuICogQHJldHVybiB7c3RyaW5nfVxuICovXG5mdW5jdGlvbiB0czJ0Yyh0aW1lLCBsZWFkaW5nWmVyb3MsIGZvcmNlSG91cnMsIHNob3dNaWxsaXMpIHtcbiAgdmFyIGhvdXJzLCBtaW51dGVzLCBzZWNvbmRzLCBtaWxsaXNlY29uZHM7XG4gIHZhciB0aW1lY29kZSA9ICcnO1xuXG4gIGlmICh0aW1lID09PSAwKSB7XG4gICAgcmV0dXJuIChmb3JjZUhvdXJzID8gJzAwOjAwOjAwJyA6ICcwMDowMCcpO1xuICB9XG5cbiAgLy8gcHJldmVudCBuZWdhdGl2ZSB2YWx1ZXMgZnJvbSBwbGF5ZXJcbiAgaWYgKCF0aW1lIHx8IHRpbWUgPD0gMCkge1xuICAgIHJldHVybiAoZm9yY2VIb3VycyA/ICctLTotLTotLScgOiAnLS06LS0nKTtcbiAgfVxuXG4gIGhvdXJzID0gTWF0aC5mbG9vcih0aW1lIC8gNjAgLyA2MCk7XG4gIG1pbnV0ZXMgPSBNYXRoLmZsb29yKHRpbWUgLyA2MCkgJSA2MDtcbiAgc2Vjb25kcyA9IE1hdGguZmxvb3IodGltZSAlIDYwKSAlIDYwO1xuICBtaWxsaXNlY29uZHMgPSBNYXRoLmZsb29yKHRpbWUgJSAxICogMTAwMCk7XG5cbiAgaWYgKHNob3dNaWxsaXMgJiYgbWlsbGlzZWNvbmRzKSB7XG4gICAgdGltZWNvZGUgPSAnLicgKyB6ZXJvRmlsbChtaWxsaXNlY29uZHMsIDMpO1xuICB9XG5cbiAgdGltZWNvZGUgPSAnOicgKyB6ZXJvRmlsbChzZWNvbmRzLCAyKSArIHRpbWVjb2RlO1xuXG4gIGlmIChob3VycyA9PT0gMCAmJiAhZm9yY2VIb3VycyAmJiAhbGVhZGluZ1plcm9zICkge1xuICAgIHJldHVybiBtaW51dGVzLnRvU3RyaW5nKCkgKyB0aW1lY29kZTtcbiAgfVxuXG4gIHRpbWVjb2RlID0gemVyb0ZpbGwobWludXRlcywgMikgKyB0aW1lY29kZTtcblxuICBpZiAoaG91cnMgPT09IDAgJiYgIWZvcmNlSG91cnMpIHtcbiAgICAvLyByZXF1aXJlZCAobWludXRlcyA6IHNlY29uZHMpXG4gICAgcmV0dXJuIHRpbWVjb2RlO1xuICB9XG5cbiAgaWYgKGxlYWRpbmdaZXJvcykge1xuICAgIHJldHVybiB6ZXJvRmlsbChob3VycywgMikgKyAnOicgKyB0aW1lY29kZTtcbiAgfVxuXG4gIHJldHVybiBob3VycyArICc6JyArIHRpbWVjb2RlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICAvKipcbiAgICogY29udmVuaWVuY2UgbWV0aG9kIGZvciBjb252ZXJ0aW5nIHRpbWVzdGFtcHMgdG9cbiAgICogQHBhcmFtIHtOdW1iZXJ9IHRpbWVzdGFtcFxuICAgKiBAcmV0dXJucyB7U3RyaW5nfSB0aW1lY29kZVxuICAgKi9cbiAgZnJvbVRpbWVTdGFtcDogZnVuY3Rpb24gKHRpbWVzdGFtcCkge1xuICAgIHJldHVybiB0czJ0Yyh0aW1lc3RhbXAsIHRydWUsIHRydWUpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBhY2NlcHRzIGFycmF5IHdpdGggc3RhcnQgYW5kIGVuZCB0aW1lIGluIHNlY29uZHNcbiAgICogcmV0dXJucyB0aW1lY29kZSBpbiBkZWVwLWxpbmtpbmcgZm9ybWF0XG4gICAqIEBwYXJhbSB7QXJyYXl9IHRpbWVzXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gbGVhZGluZ1plcm9zXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gW2ZvcmNlSG91cnNdXG4gICAqIEByZXR1cm4ge3N0cmluZ31cbiAgICovXG4gIGdlbmVyYXRlOiBmdW5jdGlvbiAodGltZXMsIGxlYWRpbmdaZXJvcywgZm9yY2VIb3Vycykge1xuICAgIGlmICh0aW1lc1sxXSA+IDAgJiYgdGltZXNbMV0gPCA5OTk5OTk5ICYmIHRpbWVzWzBdIDwgdGltZXNbMV0pIHtcbiAgICAgIHJldHVybiB0czJ0Yyh0aW1lc1swXSwgbGVhZGluZ1plcm9zLCBmb3JjZUhvdXJzKSArICcsJyArIHRzMnRjKHRpbWVzWzFdLCBsZWFkaW5nWmVyb3MsIGZvcmNlSG91cnMpO1xuICAgIH1cbiAgICByZXR1cm4gdHMydGModGltZXNbMF0sIGxlYWRpbmdaZXJvcywgZm9yY2VIb3Vycyk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIHBhcnNlcyB0aW1lIGNvZGUgaW50byBzZWNvbmRzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0aW1lY29kZVxuICAgKiBAcmV0dXJuIHtBcnJheX1cbiAgICovXG4gIHBhcnNlOiBmdW5jdGlvbiAodGltZWNvZGUpIHtcbiAgICBpZiAoIXRpbWVjb2RlKSB7XG4gICAgICByZXR1cm4gW2ZhbHNlLCBmYWxzZV07XG4gICAgfVxuXG4gICAgdmFyIHRpbWVwYXJ0cyA9IHRpbWVjb2RlLnNwbGl0KCctJyk7XG5cbiAgICBpZiAoIXRpbWVwYXJ0cy5sZW5ndGgpIHtcbiAgICAgIGNvbnNvbGUud2Fybignbm8gdGltZXBhcnRzOicsIHRpbWVjb2RlKTtcbiAgICAgIHJldHVybiBbZmFsc2UsIGZhbHNlXTtcbiAgICB9XG5cbiAgICB2YXIgc3RhcnRUaW1lID0gZXh0cmFjdFRpbWUodGltZXBhcnRzLnNoaWZ0KCkpO1xuICAgIHZhciBlbmRUaW1lID0gZXh0cmFjdFRpbWUodGltZXBhcnRzLnNoaWZ0KCkpO1xuXG4gICAgcmV0dXJuIChlbmRUaW1lID4gc3RhcnRUaW1lKSA/IFtzdGFydFRpbWUsIGVuZFRpbWVdIDogW3N0YXJ0VGltZSwgZmFsc2VdO1xuICB9LFxuXG4gIGdldFN0YXJ0VGltZUNvZGU6IGZ1bmN0aW9uIGdldFN0YXJ0VGltZWNvZGUoc3RhcnQpIHtcbiAgICAgIHJldHVybiB0aGlzLnBhcnNlKHN0YXJ0KVswXTtcbiAgfVxufTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi90aW1lY29kZS5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxuLypcbiBbXG4ge3R5cGU6IFwiaW1hZ2VcIiwgXCJ0aXRsZVwiOiBcIlRoZSB2ZXJ5IGJlc3QgSW1hZ2VcIiwgXCJ1cmxcIjogXCJodHRwOi8vZG9tYWluLmNvbS9pbWFnZXMvdGVzdDEucG5nXCJ9LFxuIHt0eXBlOiBcInNob3dub3RlXCIsIFwidGV4dFwiOiBcIlBBUEFQQVBBUEFQQUdFTk9cIn0sXG4ge3R5cGU6IFwidG9waWNcIiwgc3RhcnQ6IDAsIGVuZDogMSwgcTp0cnVlLCB0aXRsZTogXCJUaGUgdmVyeSBmaXJzdCBjaGFwdGVyXCIgfSxcbiB7dHlwZTogXCJhdWRpb1wiLCBzdGFydDogMCwgZW5kOiAxLCBxOnRydWUsIGNsYXNzOiAnc3BlZWNoJ30sXG4ge3R5cGU6IFwiYXVkaW9cIiwgc3RhcnQ6IDEsIGVuZDogMiwgcTp0cnVlLCBjbGFzczogJ211c2ljJ30sXG4ge3R5cGU6IFwiYXVkaW9cIiwgc3RhcnQ6IDIsIGVuZDogMywgcTp0cnVlLCBjbGFzczogJ25vaXNlJ30sXG4ge3R5cGU6IFwiYXVkaW9cIiwgc3RhcnQ6IDQsIGVuZDogNSwgcTp0cnVlLCBjbGFzczogJ3NpbGVuY2UnfSxcbiB7dHlwZTogXCJjb250ZW50XCIsIHN0YXJ0OiAwLCBlbmQ6IDEsIHE6dHJ1ZSwgdGl0bGU6IFwiVGhlIHZlcnkgZmlyc3QgY2hhcHRlclwiLCBjbGFzczonYWR2ZXJ0aXNlbWVudCd9LFxuIHt0eXBlOiBcImxvY2F0aW9uXCIsIHN0YXJ0OiAwLCBlbmQ6IDEsIHE6ZmFsc2UsIHRpdGxlOiBcIkFyb3VuZCBCZXJsaW5cIiwgbGF0OjEyLjEyMywgbG9uOjUyLjIzNCwgZGlhbWV0ZXI6MTIzIH0sXG4ge3R5cGU6IFwiY2hhdFwiLCBxOmZhbHNlLCBzdGFydDogMC4xMiwgXCJkYXRhXCI6IFwiRVJTVEVSICYgSElUTEVSISEhXCJ9LFxuIHt0eXBlOiBcInNob3dub3RlXCIsIHN0YXJ0OiAwLjIzLCBcImRhdGFcIjogXCJKZW1hbmQgdmFkZXJ0XCJ9LFxuIHt0eXBlOiBcImltYWdlXCIsIFwibmFtZVwiOiBcIlRoZSB2ZXJ5IGJlc3QgSW1hZ2VcIiwgXCJ1cmxcIjogXCJodHRwOi8vZG9tYWluLmNvbS9pbWFnZXMvdGVzdDEucG5nXCJ9LFxuIHt0eXBlOiBcImxpbmtcIiwgXCJuYW1lXCI6IFwiQW4gaW50ZXJlc3RpbmcgbGlua1wiLCBcInVybFwiOiBcImh0dHA6Ly9cIn0sXG4ge3R5cGU6IFwidG9waWNcIiwgc3RhcnQ6IDEsIGVuZDogMiwgXCJuYW1lXCI6IFwiVGhlIHZlcnkgZmlyc3QgY2hhcHRlclwiLCBcInVybFwiOiBcIlwifSxcbiBdXG4gKi9cbnZhciB0YyA9IHJlcXVpcmUoJy4vdGltZWNvZGUnKVxuICAsIGNhcCA9IHJlcXVpcmUoJy4vdXRpbCcpLmNhcDtcblxuZnVuY3Rpb24gYWRkVHlwZSh0eXBlKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoZWxlbWVudCkge1xuICAgIGVsZW1lbnQudHlwZSA9IHR5cGU7XG4gICAgcmV0dXJuIGVsZW1lbnQ7XG4gIH07XG59XG5cbmZ1bmN0aW9uIGNhbGwobGlzdGVuZXIpIHtcbiAgbGlzdGVuZXIodGhpcyk7XG59XG5cbmZ1bmN0aW9uIGZpbHRlckJ5VHlwZSh0eXBlKSB7XG4gIHJldHVybiBmdW5jdGlvbiAocmVjb3JkKSB7XG4gICAgcmV0dXJuIChyZWNvcmQudHlwZSA9PT0gdHlwZSk7XG4gIH07XG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7VGltZWxpbmV9IHRpbWVsaW5lXG4gKi9cbmZ1bmN0aW9uIGxvZ0N1cnJlbnRUaW1lKHRpbWVsaW5lKSB7XG4gIGNvbnNvbGUubG9nKCdUaW1lbGluZScsICdjdXJyZW50VGltZScsIHRpbWVsaW5lLmdldFRpbWUoKSk7XG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBwYXJhbXNcbiAqIEByZXR1cm5zIHtib29sZWFufSB0cnVlIGlmIGF0IGxlYXN0IG9uZSBjaGFwdGVyIGlzIHByZXNlbnRcbiAqL1xuZnVuY3Rpb24gY2hlY2tGb3JDaGFwdGVycyhwYXJhbXMpIHtcbiAgcmV0dXJuICEhcGFyYW1zLmNoYXB0ZXJzICYmIChcbiAgICB0eXBlb2YgcGFyYW1zLmNoYXB0ZXJzID09PSAnb2JqZWN0JyAmJiBwYXJhbXMuY2hhcHRlcnMubGVuZ3RoID4gMVxuICAgICk7XG59XG5cbmZ1bmN0aW9uIHBhcnNlKGRhdGEpIHtcbiAgcmV0dXJuIGRhdGE7XG59XG5cbmZ1bmN0aW9uIHN0b3BPbkVuZFRpbWUoKSB7XG4gIGlmICh0aGlzLmN1cnJlbnRUaW1lID49IHRoaXMuZW5kVGltZSkge1xuICAgIGNvbnNvbGUubG9nKCdFTkRUSU1FIFJFQUNIRUQnKTtcbiAgICB0aGlzLnBsYXllci5zdG9wKCk7XG4gICAgZGVsZXRlIHRoaXMuZW5kVGltZTtcbiAgfVxufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0hUTUxNZWRpYUVsZW1lbnR9IHBsYXllclxuICogQHBhcmFtIHtvYmplY3R9IGRhdGFcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBUaW1lbGluZShwbGF5ZXIsIGRhdGEpIHtcbiAgdGhpcy5wbGF5ZXIgPSBwbGF5ZXI7XG4gIHRoaXMuaGFzQ2hhcHRlcnMgPSBjaGVja0ZvckNoYXB0ZXJzKGRhdGEpO1xuICB0aGlzLm1vZHVsZXMgPSBbXTtcbiAgdGhpcy5saXN0ZW5lcnMgPSBbbG9nQ3VycmVudFRpbWVdO1xuICB0aGlzLmN1cnJlbnRUaW1lID0gLTE7XG4gIHRoaXMuZHVyYXRpb24gPSBkYXRhLmR1cmF0aW9uO1xuICB0aGlzLmJ1ZmZlcmVkVGltZSA9IDA7XG4gIHRoaXMucmVzdW1lID0gcGxheWVyLnBhdXNlZDtcbiAgdGhpcy5zZWVraW5nID0gZmFsc2U7XG59XG5cblRpbWVsaW5lLnByb3RvdHlwZS5nZXREYXRhID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5kYXRhO1xufTtcblxuVGltZWxpbmUucHJvdG90eXBlLmdldERhdGFCeVR5cGUgPSBmdW5jdGlvbiAodHlwZSkge1xuICByZXR1cm4gdGhpcy5kYXRhLmZpbHRlcihmaWx0ZXJCeVR5cGUodHlwZSkpO1xufTtcblxuVGltZWxpbmUucHJvdG90eXBlLmFkZE1vZHVsZSA9IGZ1bmN0aW9uIChtb2R1bGUpIHtcbiAgaWYgKG1vZHVsZS51cGRhdGUpIHtcbiAgICB0aGlzLmxpc3RlbmVycy5wdXNoKG1vZHVsZS51cGRhdGUpO1xuICB9XG4gIGlmIChtb2R1bGUuZGF0YSkge1xuICAgIHRoaXMuZGF0YSA9IG1vZHVsZS5kYXRhO1xuICB9XG4gIHRoaXMubW9kdWxlcy5wdXNoKG1vZHVsZSk7XG59O1xuXG5UaW1lbGluZS5wcm90b3R5cGUucGxheVJhbmdlID0gZnVuY3Rpb24gKHJhbmdlKSB7XG4gIGlmICghcmFuZ2UgfHwgIXJhbmdlLmxlbmd0aCB8fCAhcmFuZ2Uuc2hpZnQpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaW1lbGluZS5wbGF5UmFuZ2UgY2FsbGVkIHdpdGhvdXQgYSByYW5nZScpO1xuICB9XG4gIHRoaXMuc2V0VGltZShyYW5nZS5zaGlmdCgpKTtcbiAgdGhpcy5zdG9wQXQocmFuZ2Uuc2hpZnQoKSk7XG59O1xuXG5UaW1lbGluZS5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gIGNvbnNvbGUubG9nKCdUaW1lbGluZScsICd1cGRhdGUnLCBldmVudCk7XG4gIHRoaXMuc2V0QnVmZmVyZWRUaW1lKGV2ZW50KTtcblxuICBpZiAoZXZlbnQgJiYgZXZlbnQudHlwZSA9PT0gJ3RpbWV1cGRhdGUnKSB7XG4gICAgdGhpcy5jdXJyZW50VGltZSA9IHRoaXMucGxheWVyLmN1cnJlbnRUaW1lO1xuICB9XG4gIHRoaXMubGlzdGVuZXJzLmZvckVhY2goY2FsbCwgdGhpcyk7XG59O1xuXG5UaW1lbGluZS5wcm90b3R5cGUuZW1pdEV2ZW50c0JldHdlZW4gPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCkge1xuICB2YXIgZW1pdFN0YXJ0ZWQgPSBmYWxzZSxcbiAgICBlbWl0ID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICB2YXIgY3VzdG9tRXZlbnQgPSBuZXcgJC5FdmVudChldmVudC50eXBlLCBldmVudCk7XG4gICAgICAkKHRoaXMpLnRyaWdnZXIoY3VzdG9tRXZlbnQpO1xuICAgIH0uYmluZCh0aGlzKTtcbiAgdGhpcy5kYXRhLm1hcChmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICB2YXIgbGF0ZXIgPSAoZXZlbnQuc3RhcnQgPiBzdGFydCksXG4gICAgICBlYXJsaWVyID0gKGV2ZW50LmVuZCA8IHN0YXJ0KSxcbiAgICAgIGVuZGVkID0gKGV2ZW50LmVuZCA8IGVuZCk7XG5cbiAgICBpZiAobGF0ZXIgJiYgZWFybGllciAmJiAhZW5kZWQgfHwgZW1pdFN0YXJ0ZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdUaW1lbGluZScsICdFbWl0JywgZXZlbnQpO1xuICAgICAgZW1pdChldmVudCk7XG4gICAgfVxuICAgIGVtaXRTdGFydGVkID0gbGF0ZXI7XG4gIH0pO1xufTtcblxuLyoqXG4gKiByZXR1cm5zIGlmIHRpbWUgaXMgYSB2YWxpZCB0aW1lc3RhbXAgaW4gY3VycmVudCB0aW1lbGluZVxuICogQHBhcmFtIHsqfSB0aW1lXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuVGltZWxpbmUucHJvdG90eXBlLmlzVmFsaWRUaW1lID0gZnVuY3Rpb24gKHRpbWUpIHtcbiAgcmV0dXJuICh0eXBlb2YgdGltZSA9PT0gJ251bWJlcicgJiYgIWlzTmFOKHRpbWUpICYmIHRpbWUgPj0gMCAmJiB0aW1lIDw9IHRoaXMuZHVyYXRpb24pO1xufTtcblxuVGltZWxpbmUucHJvdG90eXBlLnNldFRpbWUgPSBmdW5jdGlvbiAodGltZSkge1xuICBpZiAoIXRoaXMuaXNWYWxpZFRpbWUodGltZSkpIHtcbiAgICBjb25zb2xlLndhcm4oJ1RpbWVsaW5lJywgJ3NldFRpbWUnLCAndGltZSBvdXQgb2YgYm91bmRzJywgdGltZSk7XG4gICAgcmV0dXJuIHRoaXMuY3VycmVudFRpbWU7XG4gIH1cblxuICBjb25zb2xlLmxvZygnVGltZWxpbmUnLCAnc2V0VGltZScsICd0aW1lJywgdGltZSk7XG4gIHRoaXMuY3VycmVudFRpbWUgPSB0aW1lO1xuICB0aGlzLnVwZGF0ZSgpO1xuXG4gIC8vIGF2b2lkIGV2ZW50IGhlbGxmaXJlXG4gIGlmICh0aGlzLnNlZWtpbmcpIHsgcmV0dXJuIHRoaXMuY3VycmVudFRpbWU7IH1cblxuICBjb25zb2xlLmxvZygnY2FucGxheScsICdzZXRUaW1lJywgJ3BsYXllclN0YXRlJywgdGhpcy5wbGF5ZXIucmVhZHlTdGF0ZSk7XG4gIGlmICh0aGlzLnBsYXllci5yZWFkeVN0YXRlID09PSB0aGlzLnBsYXllci5IQVZFX0VOT1VHSF9EQVRBKSB7XG4gICAgdGhpcy5wbGF5ZXIuc2V0Q3VycmVudFRpbWUodGltZSk7XG4gICAgcmV0dXJuIHRoaXMuY3VycmVudFRpbWU7XG4gIH1cblxuICAvLyBUT0RPIHZpc3VhbGl6ZSBidWZmZXIgc3RhdGVcbiAgLy8gJChkb2N1bWVudCkuZmluZCgnLnBsYXknKS5jc3Moe2NvbG9yOidyZWQnfSk7XG4gICQodGhpcy5wbGF5ZXIpLm9uZSgnY2FucGxheScsIGZ1bmN0aW9uICgpIHtcbiAgICAvLyBUT0RPIHJlbW92ZSBidWZmZXIgc3RhdGUgdmlzdWFsXG4gICAgLy8gJChkb2N1bWVudCkuZmluZCgnLnBsYXknKS5jc3Moe2NvbG9yOid3aGl0ZSd9KTtcbiAgICBjb25zb2xlLmxvZygnUGxheWVyJywgJ2NhbnBsYXknLCAnYnVmZmVyZWQnLCB0aW1lKTtcbiAgICB0aGlzLnNldEN1cnJlbnRUaW1lKHRpbWUpO1xuICB9KTtcblxuICByZXR1cm4gdGhpcy5jdXJyZW50VGltZTtcbn07XG5cblRpbWVsaW5lLnByb3RvdHlwZS5zZWVrID0gZnVuY3Rpb24gKHRpbWUpIHtcbiAgY29uc29sZS5sb2coJ3NlZWsnLCAnc2VlaycsIHRoaXMucmVzdW1lKTtcbiAgdGhpcy5zZWVraW5nID0gdHJ1ZTtcbiAgdGhpcy5jdXJyZW50VGltZSA9IGNhcCh0aW1lLCAwLCB0aGlzLmR1cmF0aW9uKTtcbiAgdGhpcy5zZXRUaW1lKHRoaXMuY3VycmVudFRpbWUpO1xufTtcblxuVGltZWxpbmUucHJvdG90eXBlLnNlZWtTdGFydCA9IGZ1bmN0aW9uICgpIHtcbiAgY29uc29sZS5sb2coJ3NlZWsnLCAnc3RhcnQnLCB0aGlzLnJlc3VtZSk7XG4gIHRoaXMucmVzdW1lID0gIXRoaXMucGxheWVyLnBhdXNlZDsgLy8gc2V0dGluZyB0aGlzIHRvIGZhbHNlIG1ha2VzIFNhZmFyaSBoYXBweVxuICBpZiAodGhpcy5yZXN1bWUpIHtcbiAgICB0aGlzLnBsYXllci5wYXVzZSgpO1xuICB9XG59O1xuXG5UaW1lbGluZS5wcm90b3R5cGUuc2Vla0VuZCA9IGZ1bmN0aW9uICgpIHtcbiAgY29uc29sZS5sb2coJ3NlZWsnLCAnZW5kJywgdGhpcy5yZXN1bWUpO1xuICB0aGlzLnNlZWtpbmcgPSBmYWxzZTtcbiAgdGhpcy5zZXRUaW1lKHRoaXMuY3VycmVudFRpbWUpOyAvL2ZvcmNlIGxhdGVzdCBwb3NpdGlvbiBpbiB0cmFja1xuICBpZiAodGhpcy5yZXN1bWUpIHtcbiAgICBjb25zb2xlLmxvZygnc2VlaycsICdlbmQnLCAncmVzdW1lJywgdGhpcy5jdXJyZW50VGltZSk7XG4gICAgdGhpcy5wbGF5ZXIucGxheSgpO1xuICB9XG4gIHRoaXMucmVzdW1lID0gIXRoaXMucGxheWVyLnBhdXNlZDsgLy8gc2Vla3N0YXJ0IG1heSBub3QgYmUgY2FsbGVkXG59O1xuXG5UaW1lbGluZS5wcm90b3R5cGUuc3RvcEF0ID0gZnVuY3Rpb24gKHRpbWUpIHtcbiAgaWYgKCF0aW1lIHx8IHRpbWUgPD0gMCB8fCB0aW1lID4gdGhpcy5kdXJhdGlvbikge1xuICAgIHJldHVybiBjb25zb2xlLndhcm4oJ1RpbWVsaW5lJywgJ3N0b3BBdCcsICd0aW1lIG91dCBvZiBib3VuZHMnLCB0aW1lKTtcbiAgfVxuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHRoaXMuZW5kVGltZSA9IHRpbWU7XG4gIHRoaXMubGlzdGVuZXJzLnB1c2goZnVuY3Rpb24gKCkge1xuICAgIHN0b3BPbkVuZFRpbWUuY2FsbChzZWxmKTtcbiAgfSk7XG59O1xuXG5UaW1lbGluZS5wcm90b3R5cGUuZ2V0VGltZSA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuY3VycmVudFRpbWU7XG59O1xuXG5UaW1lbGluZS5wcm90b3R5cGUuZ2V0QnVmZmVyZWQgPSBmdW5jdGlvbiAoKSB7XG4gIGlmIChpc05hTih0aGlzLmJ1ZmZlcmVkVGltZSkpIHtcbiAgICBjb25zb2xlLndhcm4oJ1RpbWVsaW5lJywgJ2dldEJ1ZmZlcmVkJywgJ2J1ZmZlcmVkVGltZSBpcyBub3QgYSBudW1iZXInKTtcbiAgICByZXR1cm4gMDtcbiAgfVxuICByZXR1cm4gdGhpcy5idWZmZXJlZFRpbWU7XG59O1xuXG5UaW1lbGluZS5wcm90b3R5cGUuc2V0QnVmZmVyZWRUaW1lID0gZnVuY3Rpb24gKGUpIHtcbiAgdmFyIHRhcmdldCA9IChlICE9PSB1bmRlZmluZWQpID8gZS50YXJnZXQgOiB0aGlzLnBsYXllcjtcbiAgdmFyIGJ1ZmZlcmVkID0gMDtcblxuICAvLyBuZXdlc3QgSFRNTDUgc3BlYyBoYXMgYnVmZmVyZWQgYXJyYXkgKEZGNCwgV2Via2l0KVxuICBpZiAodGFyZ2V0ICYmIHRhcmdldC5idWZmZXJlZCAmJiB0YXJnZXQuYnVmZmVyZWQubGVuZ3RoID4gMCAmJiB0YXJnZXQuYnVmZmVyZWQuZW5kICYmIHRhcmdldC5kdXJhdGlvbikge1xuICAgIGJ1ZmZlcmVkID0gdGFyZ2V0LmJ1ZmZlcmVkLmVuZCh0YXJnZXQuYnVmZmVyZWQubGVuZ3RoIC0gMSk7XG4gIH1cbiAgLy8gU29tZSBicm93c2VycyAoZS5nLiwgRkYzLjYgYW5kIFNhZmFyaSA1KSBjYW5ub3QgY2FsY3VsYXRlIHRhcmdldC5idWZmZXJlcmVkLmVuZCgpXG4gIC8vIHRvIGJlIGFueXRoaW5nIG90aGVyIHRoYW4gMC4gSWYgdGhlIGJ5dGUgY291bnQgaXMgYXZhaWxhYmxlIHdlIHVzZSB0aGlzIGluc3RlYWQuXG4gIC8vIEJyb3dzZXJzIHRoYXQgc3VwcG9ydCB0aGUgZWxzZSBpZiBkbyBub3Qgc2VlbSB0byBoYXZlIHRoZSBidWZmZXJlZEJ5dGVzIHZhbHVlIGFuZFxuICAvLyBzaG91bGQgc2tpcCB0byB0aGVyZS4gVGVzdGVkIGluIFNhZmFyaSA1LCBXZWJraXQgaGVhZCwgRkYzLjYsIENocm9tZSA2LCBJRSA3LzguXG4gIGVsc2UgaWYgKHRhcmdldCAmJiB0YXJnZXQuYnl0ZXNUb3RhbCAhPT0gdW5kZWZpbmVkICYmIHRhcmdldC5ieXRlc1RvdGFsID4gMCAmJiB0YXJnZXQuYnVmZmVyZWRCeXRlcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgYnVmZmVyZWQgPSB0YXJnZXQuYnVmZmVyZWRCeXRlcyAvIHRhcmdldC5ieXRlc1RvdGFsICogdGFyZ2V0LmR1cmF0aW9uO1xuICB9XG4gIC8vIEZpcmVmb3ggMyB3aXRoIGFuIE9nZyBmaWxlIHNlZW1zIHRvIGdvIHRoaXMgd2F5XG4gIGVsc2UgaWYgKGUgJiYgZS5sZW5ndGhDb21wdXRhYmxlICYmIGUudG90YWwgIT09IDApIHtcbiAgICBidWZmZXJlZCA9IGUubG9hZGVkIC8gZS50b3RhbCAqIHRhcmdldC5kdXJhdGlvbjtcbiAgfVxuICB2YXIgY2FwcGVkVGltZSA9IGNhcChidWZmZXJlZCwgMCwgdGFyZ2V0LmR1cmF0aW9uKTtcbiAgY29uc29sZS5sb2coJ1RpbWVsaW5lJywgJ3NldEJ1ZmZlcmVkVGltZScsIGNhcHBlZFRpbWUpO1xuICB0aGlzLmJ1ZmZlcmVkVGltZSA9IGNhcHBlZFRpbWU7XG59O1xuXG5UaW1lbGluZS5wcm90b3R5cGUucmV3aW5kID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLnNldFRpbWUoMCk7XG4gIHZhciBjYWxsTGlzdGVuZXJXaXRoVGhpcyA9IGZ1bmN0aW9uIF9jYWxsTGlzdGVuZXJXaXRoVGhpcyhpLCBsaXN0ZW5lcikge1xuICAgIGxpc3RlbmVyKHRoaXMpO1xuICB9LmJpbmQodGhpcyk7XG4gICQuZWFjaCh0aGlzLmxpc3RlbmVycywgY2FsbExpc3RlbmVyV2l0aFRoaXMpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBUaW1lbGluZTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi90aW1lbGluZS5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIHRjID0gcmVxdWlyZSgnLi90aW1lY29kZScpO1xuXG4vKlxuICBcInQ9MVwiXHRbKFwidFwiLCBcIjFcIildXHRzaW1wbGUgY2FzZVxuICBcInQ9MSZ0PTJcIlx0WyhcInRcIiwgXCIxXCIpLCAoXCJ0XCIsIFwiMlwiKV1cdHJlcGVhdGVkIG5hbWVcbiAgXCJhPWI9Y1wiXHRbKFwiYVwiLCBcImI9Y1wiKV1cdFwiPVwiIGluIHZhbHVlXG4gIFwiYSZiPWNcIlx0WyhcImFcIiwgXCJcIiksIChcImJcIiwgXCJjXCIpXVx0bWlzc2luZyB2YWx1ZVxuICBcIiU3ND0lNmVwdCUzQSUzMTBcIlx0WyhcInRcIiwgXCJucHQ6MTBcIildXHR1bm5lY3NzYXJ5IHBlcmNlbnQtZW5jb2RpbmdcbiAgXCJpZD0leHkmdD0xXCJcdFsoXCJ0XCIsIFwiMVwiKV1cdGludmFsaWQgcGVyY2VudC1lbmNvZGluZ1xuICBcImlkPSVFNHImdD0xXCJcdFsoXCJ0XCIsIFwiMVwiKV1cdGludmFsaWQgVVRGLThcbiAqL1xuXG4vKipcbiAqIGdldCB0aGUgdmFsdWUgb2YgYSBzcGVjaWZpYyBVUkwgaGFzaCBmcmFnbWVudFxuICogQHBhcmFtIHtzdHJpbmd9IGtleSBuYW1lIG9mIHRoZSBmcmFnbWVudFxuICogQHJldHVybnMge3N0cmluZ3xib29sZWFufSB2YWx1ZSBvZiB0aGUgZnJhZ21lbnQgb3IgZmFsc2Ugd2hlbiBub3QgZm91bmQgaW4gVVJMXG4gKi9cbmZ1bmN0aW9uIGdldEZyYWdtZW50KGtleSkge1xuICB2YXIgcXVlcnkgPSB3aW5kb3cubG9jYXRpb24uaGFzaC5zdWJzdHJpbmcoMSksXG4gICAgcGFpcnMgPSBxdWVyeS5zcGxpdCgnJicpO1xuXG4gIGlmIChxdWVyeS5pbmRleE9mKGtleSkgPT09IC0xKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBwYWlycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICB2YXIgcGFpciA9IHBhaXJzW2ldLnNwbGl0KCc9Jyk7XG4gICAgaWYgKHBhaXJbMF0gIT09IGtleSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChwYWlyLmxlbmd0aCA9PT0gMSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQocGFpclsxXSk7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIFVSTCBoYW5kbGluZyBoZWxwZXJzXG4gKi9cbm1vZHVsZS5leHBvcnRzID0ge1xuICBnZXRGcmFnbWVudDogZ2V0RnJhZ21lbnQsXG4gIGNoZWNrQ3VycmVudDogZnVuY3Rpb24gKCkge1xuICAgIHZhciB0ID0gZ2V0RnJhZ21lbnQoJ3QnKTtcbiAgICByZXR1cm4gdGMucGFyc2UodCk7XG4gIH1cbn07XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvdXJsLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIHJldHVybiBuZXcgdmFsdWUgaW4gYm91bmRzIG9mIG1pbiBhbmQgbWF4XG4gKiBAcGFyYW0ge251bWJlcn0gdmFsIGFueSBudW1iZXJcbiAqIEBwYXJhbSB7bnVtYmVyfSBtaW4gbG93ZXIgYm91bmRhcnkgZm9yIHZhbFxuICogQHBhcmFtIHtudW1iZXJ9IG1heCB1cHBlciBib3VuZGFyeSBmb3IgdmFsXG4gKiBAcmV0dXJucyB7bnVtYmVyfSByZXN1bHRpbmcgdmFsdWVcbiAqL1xuZnVuY3Rpb24gY2FwKHZhbCwgbWluLCBtYXgpIHtcbiAgLy8gY2FwIHggdmFsdWVzXG4gIHZhbCA9IE1hdGgubWF4KHZhbCwgbWluKTtcbiAgdmFsID0gTWF0aC5taW4odmFsLCBtYXgpO1xuICByZXR1cm4gdmFsO1xufVxuXG4vKipcbiAqIHJldHVybiBudW1iZXIgYXMgc3RyaW5nIGxlZnRoYW5kIGZpbGxlZCB3aXRoIHplcm9zXG4gKiBAcGFyYW0ge251bWJlcn0gbnVtYmVyIChpbnRlZ2VyKSB2YWx1ZSB0byBiZSBwYWRkZWRcbiAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aCBsZW5ndGggb2YgdGhlIHN0cmluZyB0aGF0IGlzIHJldHVybmVkXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBwYWRkZWQgbnVtYmVyXG4gKi9cbmZ1bmN0aW9uIHplcm9GaWxsIChudW1iZXIsIHdpZHRoKSB7XG4gIHZhciBzID0gbnVtYmVyLnRvU3RyaW5nKCk7XG4gIHdoaWxlIChzLmxlbmd0aCA8IHdpZHRoKSB7XG4gICAgcyA9ICcwJyArIHM7XG4gIH1cbiAgcmV0dXJuIHM7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBjYXA6IGNhcCxcbiAgemVyb0ZpbGw6IHplcm9GaWxsXG59O1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL3V0aWwuanNcIixcIi9cIikiXX0=
