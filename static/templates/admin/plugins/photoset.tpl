<!-- BEGIN status -->
<div class="row status-wrapper">
    <div class="col-lg-6">
        <div class="panel panel-default">
            <div class="panel-heading">Notices</div>
            <div class="panel-body">
                <div class="row">
                    <div class="col-sm-8">
                    <span class="lead">
                    <!-- IF status.redis.success -->
                    <i class="fa fa-fw fa-check text-success"></i>
                    <!-- ELSE -->
                    <i class="fa fa-fw fa-times text-danger"></i>
                    <!-- ENDIF status.redis.success -->
                        Redis
                    </span>
                    </div>
                </div>
                <div class="row">
                    <div class="col-sm-8">
                    <span class="lead">
                    <!-- IF status.gcs.success -->
                    <i class="fa fa-fw fa-check text-success"></i>
                    <!-- ELSE -->
                    <i class="fa fa-fw fa-times text-danger"></i>
                    <!-- ENDIF status.gcs.success -->
                        Google Cloud Storage
                    </span>
                    </div>
                    <div class="col-sm-4">
                        <span class="lead"></span>
                        <a class="btn btn-link btn-xs" href="#" data-toggle="modal"
                           data-target="#gcs-connection__modal">connection</a>
                        <!-- IF status.gcs.connection -->
                        <a class="btn btn-link btn-xs" href="#" data-toggle="modal"
                           data-target="#gcs-settings__modal">settings</a>
                        <!-- ELSE -->
                        <a class="btn btn-link btn-xs disabled" href="#" data-toggle="modal"
                           data-target="#gcs-settings__modal">settings</a>
                        <!-- ENDIF status.gcs.connection -->
                    </div>
                    <div class="col-sm-12">
                        <span class="lead"></span>
                        <!-- IF status.gcs.message -->
                        <span class="text-danger">{status.gcs.message}</span>
                        <!-- ENDIF status.gcs.message -->
                    </div>
                </div>
                <div class="row">
                    <div class="col-sm-8">
                    <span class="lead">
                    <!-- IF status.rmq.success -->
                    <i class="fa fa-fw fa-check text-success"></i>
                    <!-- ELSE -->
                    <i class="fa fa-fw fa-times text-danger"></i>
                    <!-- ENDIF status.rmq.success -->
                        RabbitMQ
                    </span>
                    </div>
                    <div class="col-sm-4">
                        <span class="lead"></span>
                        <a class="btn btn-link btn-xs" href="#" data-toggle="modal"
                           data-target="#rmq-connection__modal">connection</a>
                    </div>
                    <div class="col-sm-12">
                        <span class="lead"></span>
                        <!-- IF status.rmq.message -->
                        <span class="text-danger">{status.rmq.message}</span>
                        <!-- ENDIF status.rmq.message -->
                    </div>
                </div>
                <div class="row">
                    <div class="col-sm-8">
                    <span class="lead">
                        <!-- IF status.ipw.success -->
                            <!-- IF status.ipw.updateRequired -->
                        <i class="fa fa-fw fa-exclamation text-warning"></i>
                            <!-- ELSE -->
                        <i class="fa fa-fw fa-check text-success"></i>
                            <!-- ENDIF status.ipw.updateRequired -->
                        <!-- ELSE -->
                        <i class="fa fa-fw fa-times text-danger"></i>
                        <!-- ENDIF status.ipw.success -->
                        Image resize workers
                    </span>
                    </div>
                    <div class="col-sm-4">
                        <span class="lead"></span>
                        <a class="btn btn-link btn-xs" href="#" data-toggle="modal" data-target="#ipw-apikey__modal">API
                            keys</a>
                    </div>
                    <div class="col-sm-12">
                        <span class="lead"></span>
                        <!-- IF status.ipw.message -->
                        <span class="text-danger">{status.ipw.message}</span>
                        <!-- ENDIF status.ipw.message -->
                    </div>
                </div>
                <div class="row">
                    <div class="col-sm-8">
                    <span class="lead">
                    <!-- IF status.proxyCache.success -->
                    <i class="fa fa-fw fa-check text-success"></i>
                    <!-- ELSE -->
                    <i class="fa fa-fw fa-times text-danger"></i>
                    <!-- ENDIF status.proxyCache.success -->
                        Caching reverse proxy
                    </span>
                    </div>
                    <div class="col-sm-12">
                        <span class="lead"></span>
                        <!-- IF status.proxyCache.message -->
                        <span class="text-danger">{status.proxyCache.message}</span>
                        <!-- ENDIF status.proxyCache.message -->
                    </div>
                </div>
                <div class="row">
                    <div class="col-sm-8">
                    <span class="lead">
                    <!-- IF status.photoset.success -->
                    <i class="fa fa-fw fa-check text-success"></i>
                    <!-- ELSE -->
                    <i class="fa fa-fw fa-times text-danger"></i>
                    <!-- ENDIF status.photoset.success -->
                        Photoset
                    </span>
                    </div>
                    <div class="col-sm-4">
                        <span class="lead"></span>
                        <a class="btn btn-link btn-xs" href="#" data-toggle="modal"
                           data-target="#photoset-settings__modal">settings</a>
                    </div>
                    <div class="col-sm-12">
                        <span class="lead"></span>
                        <!-- IF status.photoset.message -->
                        <span class="text-danger">{status.photoset.message}</span>
                        <!-- ENDIF status.photoset.message -->
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="col-lg-6">
        <div class="panel panel-default">
            <div class="panel-heading">Image processing workers</div>
            <div class="panel-body">
                <table class="table">
                    <thead>
                    <tr>
                        <th>Host</th>
                        <th>Started</th>
                        <th>Version</th>
                        <th>Status</th>
                    </tr>
                    </thead>
                    <tbody>
                    <!-- BEGIN status.ipw.workers -->
                    <tr>
                        <td>{status.ipw.workers.host}</td>
                        <td class="timestamp">{status.ipw.workers.startedAt}</td>
                        <td class="worker__version">{status.ipw.workers.version}</td>
                        <td class="worker__status">{status.ipw.workers.status}</td>
                    </tr>
                    <!-- END status.ipw.workers -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>
<!-- END status -->

<script type="text/javascript">
    $( function() {
        require( ['moment', 'photoset/admin/status'], function( moment, status ) {
            status.statusFormatting( $( '.status-wrapper' ) );
        } );
    } );

    require( ['settings'], function( Settings ) {
        var Plugin = {};

        function loadModals( paths ) {
            paths.forEach( function( module ) {
                templates.parse( module, {}, function( templateHtml ) {
                    $( templateHtml ).appendTo( 'body' );
                } );
            } );
        }

        Plugin.init = function() {
            Plugin.initSettings();
            loadModals( [
                'admin/modals/gcs-connection',
                'admin/modals/gcs-settings',
                'admin/modals/rmq-connection',
                'admin/modals/ipw-apikeys',
                'admin/modals/photoset-settings'
            ] );
        };

        Plugin.initSettings = function() {
            Settings.sync( 'photoset', $( '#photoset-settings' ) );

        };

        Plugin.init();
    } );
</script>