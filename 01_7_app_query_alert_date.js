// Copyright 2024 Google LLC

/**
 * STEP 7: Building layer info on map click
 * 
 * Mention:
 *   1. Inform user on what's going on in case of any long-running actions
 *   2. Beware of conflicting asynchronous updates of the UI (!)
 *
 * @author Gennadii Donchyts (dgena@google.com)
 * @author Tyler Erickson (tyler@vorgeo.com)
 */

/*******************************************************************************
 * Model *
 ******************************************************************************/

var m = {};

// use RADD code from: https://code.earthengine.google.com/a8b49975261d3040d203e01ee48617ca
m.radd = ee.ImageCollection('projects/radar-wur/raddalert/v1');
m.regions = ['africa', 'sa', 'asia', 'ca'];

m.forest_baseline = m.radd.filterMetadata('layer','contains','forest_baseline')
                          .mosaic();

m.radd_alert = ee.ImageCollection(
  m.regions.map(
    function(region) { 
      return m.radd.filterMetadata('layer', 'contains', 'alert')
                   .filterMetadata('geography', 'equals', region)
                   .sort('system:time_end', false)
                   .first();
    }
  )).mosaic();

m.getAlertDate = function() {
  return m.radd_alert.select('Date');
};

m.getAlertConfidence = function() {
  return m.radd_alert.select('Alert');
};


m.layerInfos = [
    {
      name: 'Alert Date',
      description: '',
      image: m.getAlertDate(),
      legend: {
        type: 'gradient',
        palette: ["ffffcc", "ffeda0", "fed976", "feb24c", "fd8d3c", "fc4e2a", "e31a1c", "bd0026", "800026"],
        min: 20000,
        max: 24000,
        labelMin: '2000',
        labelMax: '2024'
      },
      shown: true
    },
    { 
      name: 'Confidence',
      description: "",
      image: m.getAlertConfidence(),
      legend: {
        type: 'discrete',
        palette: ['00ffff', 'ea7e7d'],
        min: 2,
        max: 3,
        labels: ['2', '3']
      },
      shown: false
    },
    { 
      name: 'Primary humid tropical forest',
      description: 'Primary humid tropical forest mask 2001 from Turubanova et al (2018) with annual (Africa: 2001 - 2018; Other geographies: 2001 - 2019) forest loss (Hansen et al 2013) and mangroves (Bunting et al 2018) removed.',
      image: m.forest_baseline,
      legend: {
        type: 'discrete',
        palette: ['black'],
        opacity: 0.3,
        labels: ['']
      },
      shown: true
    },
  ];


m.toDateFromYYJJJ = function(v) {
  v = ee.Number(v);
  var year = v.divide(1000).floor().add(2000);
  var doy = v.mod(1000);
    
  return ee.Date.fromYMD(year, 1, 1).advance(doy, 'day');
};

/*******************************************************************************
 * Styling *
 ******************************************************************************/

var s = {};

// RADD alert: 2 = unconfirmed (low confidence) alert; 3 = confirmed (high confidence) alert
s.visAlertConfidence = {
    min: 2,
    max: 3,
    palette: ['00FFFF', 'EA7E7D']
};
s.visForestBaseline = {
    palette: ['black'], 
    opacity: 0.3
};
s.visAlertDate = {
    min: 20000,
    max: 24000,
    palette: ["ffffcc", "ffeda0", "fed976", "feb24c", "fd8d3c",
              "fc4e2a", "e31a1c", "bd0026", "800026"]
};

s.panelLeft = {width: '400px'};
s.titleLabel = {fontSize: '22px', fontWeight: 'bold'};
s.layerPanel = {border: '1px solid black', margin: '5px 5px 0px 5px'};
s.layerPanelName = {fontWeight: 'bold'};
s.layerPanelDescription = {color: 'grey', fontSize: '11px'};

/*******************************************************************************
 * Components *
 ******************************************************************************/

var c = {};

c.titleLabel = ui.Label('Demo App', s.titleLabel);
c.infoPanel = ui.Label('Lorem ipsum odor amet, consectetuer adipiscing elit. Ultrices facilisis ultricies nec nibh integer leo. Libero scelerisque purus ex ultricies ipsum ornare platea euismod. Cursus blandit duis ligula lobortis rhoncus quam per eu. Dictumst proin elementum sociosqu nascetur mi integer massa euismod.');

c.buildLayerPanelName = function(layerInfo) {
  return ui.Label(layerInfo.name, s.layerPanelName);
};
c.buildLayerPanelDesc = function(layerInfo) {
  return ui.Label(layerInfo.description, s.layerPanelDescription);
};

c.buildLayerLegendPanel = function(layerInfo) {
  function createLayerLegendGradient(layerInfo) {
    var colorBar = ui.Thumbnail({
      image: ee.Image.pixelLonLat().select(0),
      params: { 
        bbox: [0, 0, 1, 0.1], dimensions: '100x10', format: 'png', 
        min: 0, max: 1, palette: layerInfo.legend.palette
      },
      style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px'},
    });
    
    var legendLabels = ui.Panel({
      widgets: [
        ui.Label(layerInfo.legend.labelMin, {margin: '4px 8px'}),
        ui.Label(layerInfo.legend.labelMax, {margin: '4px 8px', stretch: 'horizontal', textAlign: 'right'})
      ],
      layout: ui.Panel.Layout.flow('horizontal')
    });
    
    return ui.Panel([colorBar, legendLabels]);
  }
  
  function createLayerLegendDiscrete(layerInfo) {
    var labels = layerInfo.legend.palette.map(function(color, i) {
      return ui.Panel([
        ui.Label('', { 
          width: '15px', 
          height: '15px', 
          backgroundColor: color, 
          border: '1px solid black',
          margin: '3px 10px'
        }),
        ui.Label(layerInfo.legend.labels[i], {
          margin: '3px 10px 0px 0px'
        })
      ], ui.Panel.Layout.flow('horizontal'));
    });

    var panel = ui.Panel({
      widgets: labels,
      layout: ui.Panel.Layout.flow('vertical')
    });
    
    return panel;
  }
  
  var legendBuilders = {
    'gradient': createLayerLegendGradient,
    'discrete': createLayerLegendDiscrete
  };
  
  print(layerInfo.legend.type);
  
  return legendBuilders[layerInfo.legend.type](layerInfo);
};

c.buildLayerControlsPanel = function(layerInfo) {
  
  function onLayerShownChanged(v) {
    layerInfo.layer.setShown(v);
  }
  
  var layerShownCheckbox = ui.Checkbox('', 
    layerInfo.shown, 
    onLayerShownChanged
  );
  
  function onLayerOpacityChanged(v) {
    layerInfo.layer.setOpacity(v);
  }
  
  var layerOpacitySlider = ui.Slider(0, 1, 1, 0.1, null, 'horizontal', false, { stretch: 'horizontal' });
  layerOpacitySlider.onSlide(onLayerOpacityChanged);
  
  return ui.Panel([
     layerShownCheckbox,
     layerOpacitySlider
    ], 
    ui.Panel.Layout.Flow('horizontal'), {
      // border: '1px solid red',
      width: '200px'
    });
};

c.buildLayerPanel = function(layerInfo) {
  var layerPanel = ui.Panel([
      c.buildLayerPanelName(layerInfo),
      ui.Panel([
        c.buildLayerLegendPanel(layerInfo),
        ui.Label('', { stretch: 'horizontal' }),
        c.buildLayerControlsPanel(layerInfo),
      ], ui.Panel.Layout.flow('horizontal')),
      c.buildLayerPanelDesc(layerInfo)
    ], 
    ui.Panel.Layout.flow('vertical'), s.layerPanel);
  return layerPanel;
};

c.layersPanel = ui.Panel(m.layerInfos.map(c.buildLayerPanel));

c.buildLayerInspectionPanel = function() {
  App.clickedPointLabel = ui.Label('Click on the map to query alert date -->');
  
  App.clickedPointLayer = ui.Map.Layer(ee.FeatureCollection([]), { color: 'yellow' }, 'clicked point');
  Map.layers().add(App.clickedPointLayer);
  
  return App.clickedPointLabel;
};

c.buildUI = function() { 
  var panelLeft = ui.Panel([
      c.titleLabel,
      c.infoPanel,
      c.layersPanel,
      c.buildLayerInspectionPanel()
    ],
    ui.Panel.Layout.flow('vertical'),
    s.panelLeft
  );
  ui.root.widgets().insert(0, panelLeft);
};

c.addMapLayers = function() {
  m.layerInfos.slice(0).reverse().map(
    function(layerInfo) {
      var legend = layerInfo.legend;

      var visParams = {
        min: legend.min,
        max: legend.max,
        palette: legend.palette 
      };
      
      var layer = ui.Map.Layer(
        layerInfo.image,
        visParams,
        layerInfo.name,
        layerInfo.shown,
        legend.opacity);
      Map.layers().add(layer);
      
      layerInfo.layer = layer;
    });
};

/*******************************************************************************
 * Composition *
 ******************************************************************************/

Map.addLayer(
    m.forest_baseline,
    s.visForestBaseline,
    'Forest baseline');
Map.addLayer(
    m.radd_alert.select('Alert'),
    s.visAlertConfidence,
    'RADD alert');
Map.addLayer(
    m.radd_alert.select('Date'),
    s.visAlertDate,
    'RADD alert date');

/*******************************************************************************
 * Behaviors *
 ******************************************************************************/

var b = {};

b.queryAlertDate = function(pt) {
  var lon = pt.lon;
  var lat = pt.lat;
  pt = ee.Geometry.Point([lon, lat]);
  
  App.clickedPointLayer.setEeObject(pt);
  
  // query alert date value at a given point
  var image = m.getAlertDate();
  var date_YYJJJ = image.reduceRegion(ee.Reducer.first(), pt, 10).get('Date');
  
  var date = m.toDateFromYYJJJ(date_YYJJJ);
  
  var dateStr = date.format('YYYY-MM-dd');
  
  dateStr.evaluate(function(s) {
    App.clickedPointLabel.setValue('Clicked point date: ' + s);
  });
};
  
Map.onClick(b.queryAlertDate);

/*******************************************************************************
 * Initialize *
 ******************************************************************************/

var App = {};

App.setupMap = function() {
  Map.setOptions('SATELLITE');
  Map.style().set({ cursor: 'crosshair' });
  Map.setCenter(10, -20, 3);
};

App.run = function() {
  App.setupMap();
  c.addMapLayers();
  c.buildUI();
};

App.run();
