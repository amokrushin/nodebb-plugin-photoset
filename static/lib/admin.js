'use strict';
/* globals $, app, socket */

define('admin/plugins/photoset', ['settings'], function(Settings) {

	var Plugin = {};

	Plugin.init = function() {
		Settings.load('photoset', $('.photoset-settings'));

		$('#save').on('click', function() {
			Settings.save('photoset', $('.photoset-settings'), function() {
				app.alert({
					type: 'success',
					alert_id: 'photoset-saved',
					title: 'Settings Saved',
					message: 'Please reload your NodeBB to apply these settings',
					clickfn: function() {
						socket.emit('admin.reload');
					}
				});
			});
		});
	};

	return Plugin;
});