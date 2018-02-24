var viewer;
var inflation = false;

$(window).on('load', function() {
  var modelName = 'models/bunny.stl';
  viewer = new Viewer('canvas-viewer', modelName);
  animate();
  eventListeners();
});

$(window).on('resize', function() {
  viewer.resize();
});

function animate() {
  requestAnimationFrame(animate);
  viewer.render();
  if (inflation) {
    viewer.inflateMesh(0.1, 0.005, 0.8);
  }
}

function eventListeners() {
  $('#startInflation').on('click', function() {
    inflation = true;
  });

  $('#stopInflation').on('click', function() {
    inflation = false;
  });

  $('#exportSTL').on('click', function() {
    var filename = $('#filename').val();
    viewer.exportSTL(filename);
  });
}
