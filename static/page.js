$(document).ready(function() {
    var ua_is_mobile = navigator.userAgent.indexOf('iPhone') !== -1 || navigator.userAgent.indexOf('Android') !== -1;
    if (ua_is_mobile) {
        $('body').addClass('mobile');
    }
    
    var user_selected = {
        event_id: null,
        service_line_id: null
    };
    
    var layers = [];
    
    var base_layer = ga.layer.create('ch.swisstopo.pixelkarte-farbe');
    base_layer.setOpacity(0.4);
    layers.push(base_layer);
    
    function vector_layer_style(feature, resolution) {
        var styles = [];
        $.each(feature.get('feature_service_lines'), function(k, row){
            if (row.event_id === user_selected.event_id) {
                var style = new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        // ZVV color ?
                        color: '#0087cc',
                        width: 3
                    })
                });
                styles.push(style);
            }        
        });
        return styles;
    }
    var vector_layer = new ol.layer.Vector({
        source: new ol.source.Vector({
            format: new ol.format.GeoJSON()
        }),
        style: vector_layer_style
    });
    layers.push(vector_layer);
    
    function service_highlight_vector_layer_style(feature, resolution) {
        var styles = [];
        $.each(feature.get('feature_service_lines'), function(k, row){
            if ((user_selected.service_line_id) && (row.service_line_id === user_selected.service_line_id) && (row.event_id === user_selected.event_id)) {
                var style = new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'red',
                        width: 3
                    })
                });
                styles.push(style);
            }        
        });
        return styles;
    }
    var service_highlight_vector_layer = new ol.layer.Vector({
        source: new ol.source.Vector({
            format: new ol.format.GeoJSON()
        }),
        style: service_highlight_vector_layer_style
    });
    layers.push(service_highlight_vector_layer);
    
    var stations_layer = new ol.layer.Vector({
        source: new ol.source.Vector({
            format: new ol.format.GeoJSON()
        }),
        style: new ol.style.Style({
            image: new ol.style.Circle({
                radius: 3,
                fill: new ol.style.Fill({
                    color: '#FF0000'
                }),
                stroke: new ol.style.Stroke({
                    color: '#CACACA',
                    width: 1
                })
            }),
            zIndex: Infinity
        })
    });
    stations_layer.set('id', 'stations');
    layers.push(stations_layer);
    
    var area_info = new ol.Overlay({
        element: $('#map_area_info')[0]
    });
    
    var map = new ga.Map({
        tooltip: false,
        target: 'map_canvas',
        layers: layers,
        overlays: [area_info]
    });
    var map_view = new ol.View2D({
        minZoom: 9,
        maxZoom: 14,
        zoom: 10,
        center: ol.proj.transform([8.71, 47.47], 'EPSG:4326', 'EPSG:21781')
    });
    map.setView(map_view);
    
    $.getJSON('data/zvv.json', function(data) {
        var events_services = {};
        
        $.ajax({
            dataType: 'json',
            url: 'data/network.geojson',
            success: function(data) {
                $.each(data.features, function(k, geojson_feature){
                    var feature;
                    
                    if (geojson_feature.geometry.type == 'LineString') {
                        var path = [];
                        $.each(geojson_feature.geometry.coordinates, function(k, point_latlng) {
                            var point = ol.proj.transform(point_latlng, 'EPSG:4326', 'EPSG:21781');
                            path.push(point);
                        });

                        feature = new ol.Feature(new ol.geom.LineString(path));
                        var data_attributes = geojson_feature.properties || {};
                        var data_service_lines = data_attributes.service_lines || '';
                        var feature_service_lines = [];
                        if (data_service_lines !== '') {
                            var service_event_parts = data_service_lines.split(',');
                            $.each(service_event_parts, function(k, row){
                                var parts = row.split('_');
                                var service_line_id = parts[0];
                                var event_id = parts[1];

                                var feature_service_line = {
                                    service_line_id: parts[0],
                                    event_id: parts[1]
                                };
                                feature_service_lines.push(feature_service_line);

                                if ((typeof events_services[event_id]) === 'undefined') {
                                    events_services[event_id] = [];
                                }
                                if (events_services[event_id].indexOf(service_line_id) === -1) {
                                    events_services[event_id].push(service_line_id);
                                }
                            });
                        }

                        feature.set('feature_service_lines', feature_service_lines);
                        vector_layer.getSource().addFeature(feature);
                        service_highlight_vector_layer.getSource().addFeature(feature);
                    }
                    
                    if (geojson_feature.geometry.type == 'Point') {
                        var point = ol.proj.transform(geojson_feature.geometry.coordinates, 'EPSG:4326', 'EPSG:21781');
                        feature = new ol.Feature(new ol.geom.Point(point));
                        feature.set('name', geojson_feature.properties.name);
                        stations_layer.getSource().addFeature(feature);
                    }
                });
            },
            async: false
        });
        
        var html_nodes = [];
        $.each(data.service_lines, function(k, row){
            var html_node = '<span class="label service_line" title="' + row.stations + '" data-id="' + row.id + '" style="color: ' + row.color + '; background-color: ' + row.bg_color + '" data-bg_color="' + row.bg_color + '">' + row.name + '</span>';
            html_nodes.push(html_node);
        });
        $('#service_lines').html(html_nodes.join(" "));
        
        $('#service_lines .service_line').mouseover(function(ev){
            var service_line_id = $(this).attr('data-id');
            if (user_selected.service_line_id === service_line_id) {
                return;
            }
            
            user_selected.service_line_id = service_line_id;
            service_highlight_vector_layer.setStyle(service_highlight_vector_layer_style);
        });
        
        $('#service_lines').mouseover(function(ev){
            if (vector_layer.getOpacity() > 0.4) {
                vector_layer.setOpacity(0.4);
            }
            if (base_layer.getOpacity() > 0.25) {
                base_layer.setOpacity(0.2);
            }
        });

        $('#map_panel').mouseout(function(ev){
            if (vector_layer.getOpacity() < 1) {
                vector_layer.setOpacity(1);
            }
            if (base_layer.getOpacity() < 0.25) {
                base_layer.setOpacity(0.4);
            }
            
            if (user_selected.service_line_id !== null) {
                user_selected.service_line_id = null;
                service_highlight_vector_layer.setStyle(service_highlight_vector_layer_style);
            }
        });
        
        var event_labels = [];
        $.each(data.events, function(k, row){
            event_labels.push(row.title);
        });
        
        function event_update(k) {
            var event_data = data.events[k];
            $('#event_title').text(event_data.title + ': ' + event_data.description);
            
            user_selected.event_id = event_data.title;
            vector_layer.setStyle(vector_layer_style);
            service_highlight_vector_layer.setStyle(service_highlight_vector_layer_style);
            
            $('#service_lines .label').each(function(k, el){
                var service_line_id = $(el).attr('data-id');
                if (events_services[event_data.id].indexOf(service_line_id) === -1) {
                    $(el).css('background-color', '#F0F0F0');
                } else {
                    $(el).css('background-color', $(el).attr('data-bg_color'));
                }
            });
        }
        
        $('#timeline').labeledslider({
            max: data.events.length - 1,
            tickLabels: event_labels,
            slide: function(event, ui) {
                event_update(ui.value);
            }
        });
        $("#timeline .ui-slider-handle").css('background', '#0087cc');
        event_update(0);
    });
    
    map.on('singleclick', function(ev) {
        var pixel = map.getEventPixel(ev.originalEvent);
        var selected_feature = null;
        map.forEachFeatureAtPixel(pixel, function(feature, layer) {
            if (layer.get('id') !== 'stations') {
                return;
            }
            selected_feature = feature;
        });
        
        if (selected_feature === null) {
            return;
        }
        
        area_info.setPosition(ev.coordinate);
        var popup_content = '<div><b>' + selected_feature.get('name') + '</b></div>';
        $('#map_area_info .ol-popup-content').html(popup_content);
        $('#map_area_info').removeClass('hide');
    });
    
    $('#map_area_info .ol-popup-closer').click(function(){
        $('#map_area_info').addClass('hide');
        return false;
    });
});