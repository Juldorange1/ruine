// Géométrie hexagonale (axial, pointy-top). Tout est global (window.*), pas de modules.

var AX_DIRS = [
  {q:1,r:0}, {q:1,r:-1}, {q:0,r:-1},
  {q:-1,r:0}, {q:-1,r:1}, {q:0,r:1}
];

function axialKey(q,r){ return q+','+r; }

function axialAdd(a,b){ return {q:a.q+b.q, r:a.r+b.r}; }
function axialScale(a,k){ return {q:a.q*k, r:a.r*k}; }
function axialNeighbor(a,i){ return axialAdd(a, AX_DIRS[i]); }

function axialNeighbors(q,r){
  var out = [];
  for (var i=0;i<6;i++) out.push(axialNeighbor({q:q,r:r}, i));
  return out;
}

function axialDistance(a,b){
  return (Math.abs(a.q-b.q) + Math.abs(a.q+a.r-b.q-b.r) + Math.abs(a.r-b.r)) / 2;
}

function hexRing(center, radius){
  if (radius === 0) return [{q:center.q, r:center.r}];
  var results = [];
  var hex = axialAdd(center, axialScale(AX_DIRS[4], radius));
  for (var i=0;i<6;i++){
    for (var j=0;j<radius;j++){
      results.push({q:hex.q, r:hex.r});
      hex = axialNeighbor(hex, i);
    }
  }
  return results;
}

function hexSpiral(center, maxRadius){
  var results = [{q:center.q, r:center.r}];
  for (var k=1;k<=maxRadius;k++) results = results.concat(hexRing(center, k));
  return results;
}

function axialToPixel(q, r, size){
  var x = size * Math.sqrt(3) * (q + r/2);
  var y = size * 1.5 * r;
  return {x:x, y:y};
}

function pixelToAxial(x, y, size){
  var q = (Math.sqrt(3)/3 * x - 1/3 * y) / size;
  var r = (2/3 * y) / size;
  return axialRound(q, r);
}

function axialRound(q, r){
  var x = q, z = r, y = -x-z;
  var rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  var xd = Math.abs(rx-x), yd = Math.abs(ry-y), zd = Math.abs(rz-z);
  if (xd > yd && xd > zd) rx = -ry-rz;
  else if (yd > zd) ry = -rx-rz;
  else rz = -rx-ry;
  return {q:rx, r:rz};
}

function hexCorners(cx, cy, size){
  var pts = [];
  for (var i=0;i<6;i++){
    var angle = Math.PI/180 * (60*i - 30);
    pts.push([cx + size*Math.cos(angle), cy + size*Math.sin(angle)]);
  }
  return pts;
}
