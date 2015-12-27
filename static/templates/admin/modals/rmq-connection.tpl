<div class="modal fade" id="rmq-connection__modal" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span
                            aria-hidden="true">&times;</span></button>
                <h4 class="modal-title" id="exampleModalLabel1">RabbitMQ
                    <small>connection settings</small>
                </h4>
            </div>
            <div class="modal-body">
                <form id="rmq-connection__form">
                    <div class="form-group">
                        <label for="rmq-host" class="control-label">Host:</label>
                        <input type="text" class="form-control" id="rmq-host" data-key="rmq.host"/>
                    </div>
                    <div class="form-group">
                        <label for="rmq-vhost" class="control-label">Vhost:</label>
                        <input type="text" class="form-control" id="rmq-vhost" data-key="rmq.vhost"/>
                    </div>
                    <div class="form-group">
                        <label for="rmq-user" class="control-label">User:</label>
                        <input type="text" class="form-control" id="rmq-user" data-key="rmq.user"/>
                    </div>
                    <div class="form-group">
                        <label for="rmq-password" class="control-label">Password:</label>
                        <input type="password" class="form-control" id="rmq-password" data-key="rmq.password"/>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>
                <button type="button" class="btn btn-primary" id="rmq-connection__save">Save changes</button>
            </div>
        </div>
    </div>
</div>

<script type="text/javascript">
    'use strict';
    /* globals define, $, socket, ajaxify, app */

    require( ['settings'], function( settings ) {
        var $form = $( '#rmq-connection__form' );
        var $modal = $( '#rmq-connection__modal' );

        settings.sync( 'photoset', $form );
        $modal.on( 'show.bs.modal', function() {
            settings.sync( 'photoset', $form );
        } );

        $( '#rmq-connection__save' ).on( 'click', function( event ) {
            event.preventDefault();
            settings.persist( 'photoset', $form, function() {
                socket.emit( 'plugins.photoset.syncSettings', function() {
                    $( window ).trigger( 'photoset.updateStatus', 'rmq' );
                } );
            } );
            $modal.modal( 'hide' );
        } );
    } );
</script>