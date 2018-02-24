var Viewer = function (elementId, modelName) {
  if (!Detector.webgl) Detector.addGetWebGLMessage();

  this.cameraDistance = 1.0;
  this.boxSize = 0.4418847653807891;
  this.container = document.getElementById(elementId);

  // Camera
  this.camera = new THREE.PerspectiveCamera(45, this.container.clientWidth / this.container.clientHeight, 0.1, 15);
  this.camera.position.set(0, 0, this.cameraDistance);
  this.camera.lookAt(new THREE.Vector3(0, 0, 0));

  // Control
  this.controls = new THREE.OrbitControls(this.camera, this.container);
  this.controls.rotateSpeed = 2.0;
  this.controls.enablePan = false;
  this.controls.enableZoom = true;

  // Scene
  this.scene = new THREE.Scene();
  this.scene.fog = new THREE.Fog(0xffffff, 2, 15);

  // Objects
  this.loader = new THREE.STLLoader();
  this.exporter = new THREE.STLExporter();
  this.loadSTL(modelName);
  this.helpers();

  // Lights
  this.scene.add(new THREE.HemisphereLight(0x443333, 0x111122));
  this.addShadowedLight(1, 1, 1, 0xdddddd, 0.5);
  this.addShadowedLight(0.5, 1, -1, 0xaaaaaa, 1);

  // renderer
  this.renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
  this.renderer.setClearColor(this.scene.fog.color);
  this.renderer.setPixelRatio(window.devicePixelRatio);
  this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  this.renderer.gammaInput = true;
  this.renderer.gammaOutput = true;
  this.renderer.shadowMap.enabled = true;
  this.renderer.shadowMap.renderReverseSided = false;
  this.container.appendChild(this.renderer.domElement);
};

Viewer.prototype.resize = function () {
  this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
  this.camera.updateProjectionMatrix();
  this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
};

Viewer.prototype.render = function () {
  this.controls.update();
  this.renderer.render(this.scene, this.camera);
}

Viewer.prototype.loadSTL = function (filename) {
  var scope = this;
  this.loader.load(filename, function (geometry) {
    // Geometry
    if (geometry instanceof THREE.BufferGeometry) {
      geometry = new THREE.Geometry().fromBufferGeometry(geometry);
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.center();
    geometry.mergeVertices();

    // Material
    var material = new THREE.MeshPhongMaterial({color:0xaaaaaa, specular:0x111111, shininess:40});

    // Mesh
    var mesh = new THREE.Mesh(geometry, material);
    var size = geometry.boundingBox.getSize();
    var max = Math.max(Math.max(size.x, size.y), size.z);
    var scale = scope.boxSize / max;
    mesh.rotation.set(0, deg2rad(-180), 0);
    mesh.scale.set(scale, scale, scale);
    scope.scene.add(mesh);
    scope.initMeshInflation(geometry);
    scope.mesh = mesh;
  });
};

Viewer.prototype.exportSTL = function (filename) {
  var data = this.exporter.parse(this.mesh);
  var blob = new Blob([data], {type: 'text/plain'});
  saveAs(blob, filename);
};

Viewer.prototype.helpers = function () {
  // Box
  var box = new THREE.Box3();
  var boxSize = this.boxSize;
  box.setFromCenterAndSize(new THREE.Vector3(0, 0, 0), new THREE.Vector3(boxSize, boxSize, boxSize));
  var boxHelper = new THREE.Box3Helper(box, 0x777777);
  this.boxHelper = boxHelper;
  this.scene.add(boxHelper);

  // Sphere
  // var radius = Math.sin(deg2rad(22.5));
  // var sphereGeometry = new THREE.SphereGeometry(radius, 32, 32);
  // var sphereMaterial = new THREE.MeshBasicMaterial({color:0xff0000, transparent:true, opacity:0.1});
  // var sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  // this.scene.add(sphere);
};

Viewer.prototype.addShadowedLight = function (x, y, z, color, intensity) {
  var directionalLight = new THREE.DirectionalLight(color, intensity);
  directionalLight.position.set(x, y, z);
  this.scene.add(directionalLight);
  var d = 1;
  directionalLight.shadow.camera.left = -d;
  directionalLight.shadow.camera.right = d;
  directionalLight.shadow.camera.top = d;
  directionalLight.shadow.camera.bottom = -d;
  directionalLight.shadow.camera.near = 1;
  directionalLight.shadow.camera.far = 4;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  directionalLight.shadow.bias = -0.005;
  directionalLight.castShadow = true;
}

Viewer.prototype.cameraPosition = function (degT, degP) {
  var radT = deg2rad(degT);
  var radP = deg2rad(degP);
  var z = Math.sin(radT) * Math.cos(radP);
  var x = Math.sin(radT) * Math.sin(radP);
  var y = Math.cos(radT);
  this.camera.position.set(x, y, z);
  this.render();
};

Viewer.prototype.initMeshInflation = function (geometry) {
  var faces = geometry.faces;
  var vertices = geometry.vertices;
  var pairs = {};
  var velocities = [];

  // Make pairs of vertices to calculate inflation
  for (var i = 0, len = faces.length; i < len; i++) {
    var face = faces[i];
    var vertexIds = [face.a, face.b, face.c];

    // Sort ids
    // ex. [1, 0, 2] --> [0, 1, 2]
    vertexIds.sort(function(a, b) {
      if( a < b ) return -1;
      if( a > b ) return 1;
      return 0;
    });

    for (var j = 1; j <= 3; j++) {
      if (j < 3) {
        var start = vertexIds[j-1];
        var end = vertexIds[j%3];
      } else {
        var start = vertexIds[j%3];
        var end = vertexIds[j-1];
      }

      var key = start + '_' + end;

      if (!(key in pairs)) {
        var v1 = vertices[start];
        var v2 = vertices[end];
        var dist = new THREE.Vector3().subVectors(v2, v1).length();
        pairs[key] = {'start':start, 'end':end, 'dist':dist};
      }
    }
  }

  // Initialize velocities
  // Vectors are initialized to (0, 0, 0)
  for (var i = 0, len = vertices.length; i < len; i++) {
    velocities.push(new THREE.Vector3());
  }

  this.pairs = pairs;
  this.velocities = velocities;
  this.geometry = geometry;
};

Viewer.prototype.inflateMesh = function (stiffness, amplitude, damping) {
  var pairs = this.pairs;
  var velocities = this.velocities;
  var faces = this.geometry.faces;
  var vertices = this.geometry.vertices;
  var forces = [];

  if (pairs == undefined) {
    console.error('Inflation is not ready yet');
    return;
  }

  // Initialize forces
  // Vectors are initialized to (0, 0, 0)
  for (var i = 0, len = vertices.length; i < len; i++) {
    forces.push(new THREE.Vector3());
  }

  // Compute forces
  for (var key in pairs) {
    var pair = pairs[key];
    var vertexId1 = pair.start;
    var vertexId2 = pair.end;
    var v1 = vertices[vertexId1];
    var v2 = vertices[vertexId2];
    var v3 = new THREE.Vector3().subVectors(v2, v1);
    var dist = v3.length();

    // Hook's law
    // https://www.khanacademy.org/science/physics/work-and-energy/hookes-law/a/what-is-hookes-law
    var s = stiffness * (dist - pair.dist);

    // Convert v3 to a unit vector
    v3.normalize();

    // Update force of v1
    v3.multiplyScalar(s);
    forces[vertexId1].addVectors(forces[vertexId1], v3);

    // Update force of v2
    v3.multiplyScalar(-1);
    forces[vertexId2].addVectors(forces[vertexId2], v3);
  }

  // Apply amplitude to forces
  for (var i = 0, len = faces.length; i < len; i++) {
    var face = faces[i];
    var n = new THREE.Vector3().copy(face.normal).multiplyScalar(amplitude);
    forces[face.a].addVectors(forces[face.a], n);
    forces[face.b].addVectors(forces[face.b], n);
    forces[face.c].addVectors(forces[face.c], n);
  }

  // Compute velocities
  for (var i = 0, len = velocities.length; i < len; i++) {
    velocities[i].addVectors(velocities[i], forces[i]);
    velocities[i].multiplyScalar(damping);
  }

  // Compute positions of vertices
  for (var i = 0, len = vertices.length; i < len; i++) {
    vertices[i].addVectors(vertices[i], velocities[i]);
  }

  this.geometry.computeFaceNormals();
  this.geometry.verticesNeedUpdate = true;
  this.geometry.normalNeedUpdate = true;
};
