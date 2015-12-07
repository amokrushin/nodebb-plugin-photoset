<div class="row">
    <div class="col-lg-9">
        <div class="panel panel-default">
            <div class="panel-heading">Sample Admin Page</div>
            <div class="panel-body">
                <form role="form" class="photoset-settings">
                    <div class="row">
                        <div class="col-sm-2 col-xs-12 settings-header">
                            Google Cloud Storage
                        </div>
                        <div class="col-sm-10 col-xs-12">
                            <div class="form-group">
                                <label>Project ID</label>
                                <input type="text" class="form-control" name="projectId"/><br/>

                                <label for="loadJsonKey">Load JSON key</label>
                                <input class="form-control" type="file" id="loadJsonKey"><br/>

                                <textarea class="form-control" name="privateKey" hidden></textarea>

                                <input type="text" class="form-control" name="clientEmail" hidden/>

                                <button class="btn btn-primary" id="connect">Connect</button>
                                <br/>

                                <label for="bucket">Bucket</label>
                                <select class="form-control" name="bucket">
                                    <!-- BEGIN buckets -->
                                    <option value="{buckets.name}">{buckets.name}</option>
                                    <!-- END buckets -->
                                </select>
                            </div>
                        </div>

                        <div class="col-sm-2 col-xs-12 settings-header">
                            Image resize service
                        </div>
                        <div class="col-sm-10 col-xs-12">
                            <div class="form-group">
                                <label for="rmqHost">RabbitMQ host</label>
                                <input type="text" class="form-control" id="rmqHost" name="rmqHost"/><br/>

                                <label for="rmqUser">RabbitMQ user</label>
                                <input class="form-control" type="text" id="rmqUser" name="rmqUser"><br/>

                                <label for="rmqPassword">RabbitMQ user</label>
                                <input class="form-control" type="text" id="rmqPassword" name="rmqPassword"><br/>
                            </div>
                        </div>

                        <div class="col-sm-2 col-xs-12 settings-header">
                            Static files server
                        </div>
                        <div class="col-sm-10 col-xs-12">
                            waaky3es56366804a7f5d-c000064-r000-a0302-w780.jpg
                        </div>
                        <div class="col-sm-10 col-xs-12">
                            <div class="form-group">
                                <label>Reverse proxy port</label>
                                <input type="text" class="form-control" name="reverseProxyPort"/><br/>
                            </div>
                            <div class="form-group">
                                <label>Uploads base URL</label>
                                <input type="text" class="form-control" name="uploadsBaseUrl"/><br/>
                            </div>
                        </div>

                        <div class="col-sm-2 col-xs-12 settings-header">
                            Image settings
                        </div>
                        <div class="col-sm-10 col-xs-12">
                            <div class="form-group">
                                <label for="imagePreviewMaxDimension">Preview image max dimension (width or
                                    height)</label>
                                <input type="text" class="form-control" id="imagePreviewMaxDimension"
                                       name="imagePreviewMaxDimension"/><br/>
                            </div>
                            <div class="form-group">
                                <label for="imageHighresMaxDimension">High quality image max dimension (width or
                                    height)</label>
                                <input type="text" class="form-control" id="imageHighresMaxDimension"
                                       name="imageHighresMaxDimension"/><br/>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    </div>
    <div class="col-lg-3">
        <div class="panel panel-default">
            <div class="panel-heading">Control Panel</div>
            <div class="panel-body">
                <button class="btn btn-primary" id="save">Save Settings</button>
            </div>
        </div>
    </div>
</div>


<script type="text/javascript">
    'use strict';
    /* globals define, $, socket, ajaxify, app */
    require( ['settings'], function( Settings ) {
        console.log( 'loaded' );
        var Plugin = {};

        Plugin.init = function() {
            console.log( 'init' );
            Plugin.initSettings();
            $( '#loadJsonKey' ).on( 'change', Plugin.handleFileSelect );

            $( '#connect' ).on( 'click', function( e ) {
                var projectId = $( 'input[name="projectId"]' ).val(),
                        clientEmail = $( 'input[name="clientEmail"]' ).val(),
                        privateKey = $( 'textarea[name="privateKey"]' ).val();

                e.preventDefault();
                Plugin.gcsConnect( projectId, clientEmail, privateKey, function( err, buckets ) {
                    app.alertSuccess( 'Connected successfully' );

                    var $select = $( 'select[name="bucket"]' ).html( '' );
                    buckets.forEach( function( bucket ) {
                        $select.append( $( '<option>' ).text( bucket.name ) );
                    } );
                } );
            } );
        };

        Plugin.initSettings = function() {
            Settings.load( 'photoset', $( '.photoset-settings' ) );
            $( '#save' ).on( 'click', function() {
                Settings.save( 'photoset', $( '.photoset-settings' ), function() {
                    app.alert( {
                        type: 'success',
                        alert_id: 'photoset-saved',
                        title: 'Settings Saved',
                        message: 'Please reload your NodeBB to apply these settings',
                        clickfn: function() {
                            socket.emit( 'admin.reload' );
                        }
                    } )
                } );
            } );

        };

        Plugin.handleFileSelect = function( e ) {
            var reader = new FileReader(),
                    jsonKey;

            reader.onload = function() {
                try
                {
                    jsonKey = JSON.parse( reader.result );
                } catch( err )
                {
                    return app.alertError( 'File is not valid Google JSON key' );
                }
                if( !jsonKey.client_email || !jsonKey.private_key )
                {
                    return app.alertError( 'File is not valid Google JSON key' );
                }
                $( 'input[name="clientEmail"]' ).val( jsonKey.client_email );
                $( 'textarea[name="privateKey"]' ).val( jsonKey.private_key );
            };

            reader.readAsText( e.target.files[0] );
        };

        Plugin.gcsConnect = function( projectId, clientEmail, privateKey, callback ) {
            console.log( 'gcs connect' );
            socket.emit( 'plugins.photoset.gcsConnect', {
                projectId: projectId,
                clientEmail: clientEmail,
                privateKey: privateKey
            }, function( err, data ) {
                if( err ) return app.alertError( err.message );
                callback( null, data.buckets );
            } );
        };

        Plugin.init();

    } );

    /* globals app, socket */
    //    $( document ).ready( function() {
    //        $( '#save' ).on( 'click', function() {
    //            $.post( config.relative_path + '/api/admin/plugins/dbsearch/save', {
    //                _csrf: $( '#csrf_token' ).val(),
    //                topicLimit: $( '#topicLimit' ).val(),
    //                postLimit: $( '#postLimit' ).val()
    //            }, function( data ) {
    //                if( typeof data === 'string' )
    //                {
    //                    app.alertSuccess( 'Settings saved' );
    //                }
    //            } );
    //
    //            return false;
    //        } );
    //
    //        $( '#clear-index' ).on( 'click', function() {
    //            socket.emit( 'admin.plugins.dbsearch.clearIndex', function( err ) {
    //                if( err )
    //                {
    //                    app.alertError( err.message );
    //                    clearProgress();
    //                }
    //            } );
    //            startProgress( 'Index Cleared!' );
    //            return false;
    //        } );
    //
    //        $( '#reindex' ).on( 'click', function() {
    //            socket.emit( 'admin.plugins.dbsearch.reindex', function( err ) {
    //                if( err )
    //                {
    //                    app.alertError( err.message );
    //                    clearProgress();
    //                }
    //            } );
    //            startProgress( 'Content Indexed!' );
    //
    //            return false;
    //        } );
    //    } );

</script>