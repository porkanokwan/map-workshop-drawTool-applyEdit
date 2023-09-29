import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import MapView from '@arcgis/core/views/MapView.js';
import Map from '@arcgis/core/Map.js';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import Sketch from '@arcgis/core/widgets/Sketch';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js';
import Draw from '@arcgis/core/views/draw/Draw';
import Graphic from '@arcgis/core/Graphic.js';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
})
export class MapComponent implements OnInit, OnDestroy {
  @ViewChild('mapViewRef', { static: true }) // ต้องใส่ {static: true} เสมอ
  private mapViewRef!: ElementRef<HTMLDivElement>;
  private map!: Map;
  private mapView!: any;
  private layer!: any;
  private draw!: any;
  private simpleFillSymbol = {
    type: 'simple-fill', // autocasts as SimpleFillSymbol
    color: 'purple',
    style: 'solid',
    outline: {
      // autocasts as SimpleLineSymbol
      color: 'black',
      width: 1,
    },
  };
  private polygonSketched!: any;
  private objID!: number;
  private sketch!: any;
  private graphicsLayer!: any;

  constructor() {}

  ngOnInit(): void {
    this.initializeMap();
  }

  async initializeMap() {
    // Create feature layers and add to map. สามารถ add id เข้าไปได้
    this.layer = new FeatureLayer({
      id: 'por-test',
      url: 'https://sampleserver6.arcgisonline.com/arcgis/rest/services/Wildfire/FeatureServer/2',
    });
    this.graphicsLayer = new GraphicsLayer();

    // Configure the Map
    const mapProperties = {
      basemap: 'topo-vector',
      layers: [this.layer, this.graphicsLayer], //add layer เข้า map
    };
    this.map = new Map(mapProperties);

    // Initialize the MapView
    const mapViewProperties = {
      container: this.mapViewRef.nativeElement,
      center: [-118.31966, 34.13375],
      map: this.map,
      zoom: 5,
    };
    this.mapView = new MapView(mapViewProperties);

    this.sketch = new Sketch({
      layer: this.graphicsLayer,
      view: this.mapView,
      availableCreateTools: ['polygon'],
    });

    // Listen to sketch widget's create event.
    this.sketch.on('create', (event: __esri.SketchCreateEvent) => {
      if (event.state === 'complete') {
        // Do something when finished drawing
        const add = {
          geometry: event.graphic?.geometry,
          symbol: {
            type: 'simple-line',
            color: 'red',
            style: 'solid',
          },
          attributes: { symbolid: 1, description: 'por-test' },
        };
        const addFeature = {
          addFeatures: [new Graphic(add)],
        };
        this.applyEditPolygon(addFeature);

        // remove graphics ออกจาก layer หลังจาก apply eidt เข้าไปแล้ว
        this.graphicsLayer.removeAll();
      }
    });
    this.sketch.on('update', (event: __esri.SketchUpdateEvent) => {
      if (event.state === 'complete') {
        // check ว่า complete จากการ ลบ หรือ edit complete
        if (!event.aborted) {
          // Do something when finished edit drawing
          // Setup the applyEdits parameter with edit.
          const edit = {
            geometry: event.graphics[0]?.geometry,
            symbol: {
              type: 'simple-line',
              color: 'blue',
              style: 'solid',
            },
            attributes: {
              objectid: this.objID,
              description: 'por-test',
            },
          };
          const updateFeature = {
            updateFeatures: [new Graphic(edit)],
          };
          this.applyEditPolygon(updateFeature);
        } else {
          // ไม่ต้องเรียกใช้ก็ได้ พอกดลบมันจะเข้า this.sketch.on('delete') ให้เอง
          // this.sketch.delete();
        }

        // remove graphics ออกจาก layer หลังจาก apply eidt เข้าไปแล้ว
        this.graphicsLayer.removeAll();
      }
    });
    this.sketch.on('delete', () => {
      const deleteFeature = {
        deleteFeatures: [
          new Graphic({
            attributes: {
              objectid: this.objID,
            },
          }),
        ],
      };
      this.applyEditPolygon(deleteFeature);
    });

    this.draw = new Draw({
      view: this.mapView,
    });

    this.selectExistingFeature();

    this.mapView.ui.add(this.sketch, 'top-right');
    this.mapView.ui.add(document.getElementById('line-button'), 'top-left');

    await this.mapView.when(); // wait for map to load
    return this.mapView;
  }

  // This method is for updating Polygon graphic on the map
  updatePolygon(vertices: any) {
    this.mapView.graphics.removeAll();
    this.polygonSketched = {
      type: 'polygon', // autocasts as Polygon
      rings: vertices,
      spatialReference: this.mapView.spatialReference,
    };
    const polygonGraphic = new Graphic({
      geometry: this.polygonSketched,
      symbol: this.simpleFillSymbol,
    });
    this.mapView.graphics.add(polygonGraphic);
  }

  onClickCreateLine() {
    // creates and returns an instance of PolygonDrawAction
    const action = this.draw.create('polygon');

    // fires when a vertex is added
    action.on('vertex-add', (evt: any) => {
      this.updatePolygon(evt.vertices);
    });
    // fires when the pointer moves
    action.on('cursor-update', (evt: any) => {
      this.updatePolygon(evt.vertices);
    });
    // fires when a vertex is removed
    action.on('vertex-remove', (evt: any) => {
      this.updatePolygon(evt.vertices);
    });
    // fires when the drawing is completed
    action.on('draw-complete', (evt: any) => {
      this.updatePolygon(evt.vertices);
      // Also do anything else after finished drawing
    });
  }

  applyEditPolygon(feature: any) {
    this.layer.applyEdits(feature).then((response: any) => {
      console.log('apply edit', response); // Check add/update/delete results
    });
  }

  spatialQueryGeometry(objID: any) {
    this.layer
      .queryFeatures({
        objectIds: [objID],
        outFields: ['*'],
        returnGeometry: true,
      })
      .then((response: any) => {
        this.objID = response.features[0].attributes.objectId;
        // highlight feature in map
        // this.mapView
        //   .whenLayerView(response.features[0].layer)
        //   .then((layerView: any) => {
        //     layerView.highlight(response.features[0]);
        //   });
      });
  }

  selectExistingFeature() {
    this.mapView.on('click', (event: any) => {
      this.mapView.hitTest(event).then((response: any) => {
        if (response.results.length === 2) {
          // this.spatialQueryGeometry(
          //   response.results[0].graphic.attributes.objectid
          // );
          this.objID = response.results[0]?.graphic?.attributes?.objectid;
          const editGraphic = {
            geometry: response.results[0]?.graphic?.geometry,
            symbol: {
              type: 'simple-line',
              color: [0, 170, 255, 0.8],
              style: 'solid',
            },
            attributes: {
              objectid: this.objID,
              // description: 'por-test',
            },
          };
          const graphic = new Graphic(editGraphic);
          this.graphicsLayer.add(graphic);

          // Listen to sketch's update event to do
          // graphic reshape or move
          this.sketch.update(graphic);
        }
      });
    });
  }

  ngOnDestroy() {
    if (this.mapView) {
      // Destroy the map view.
      this.mapView.container = null;
    }
  }
}
