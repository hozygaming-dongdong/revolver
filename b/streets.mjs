const stageLooks = [
  { fog: [.10, .16, .17], metal: [.72, .85, .82], floor: [.82, .90, .88], actor: 'infected-fps', height: 1.92 },
  { fog: [.085, .15, .21], metal: [.61, .79, .99], floor: [.64, .83, 1], actor: 'crawler-fps', height: 1.08 },
  { fog: [.22, .16, .115], metal: [.97, .81, .61], floor: [.87, .79, .66], actor: 'dockworker-fps', height: 2.18 },
  { fog: [.095, .19, .22], metal: [.60, .87, .93], floor: [.64, .84, .90], actor: 'guard-fps', height: 2.02 },
  { fog: [.17, .16, .12], metal: [.92, .86, .66], floor: [.91, .82, .63], actor: 'warden-fps', height: 2.75 },
];
export const actorAsset = stage => stageLooks[stage].actor;
const shade = (color, amount) => color.map(v => v * amount);

export function street(stage, route) {
  const look = stageLooks[stage], alley = stage === 0 && route === 'conserve';
  const open = route === 'charge' || route === 'boss';
  const wide = open ? 4.85 : 2.5;
  const lamp = stage === 0 ? open ? [1, .18, .068] : [.28, 1, .64]
    : stage === 1 ? [.24, .73, 1] : stage === 2 ? [1, .69, .30] : stage === 3 ? [.24, .84, .78] : [1, .75, .32];
  const fog = stage === 0 && open ? [.22, .103, .084] : look.fog;
  const batches = { ground: [], metal: [], solid: [] };
  function quad(material, color, a, b, c, d) {
    const points = [a, b, c, a, c, d], uv = [0,0, 1,0, 1,1, 0,0, 1,1, 0,1];
    for (const [i, p] of points.entries()) batches[material].push(...p, uv[2*i], uv[2*i+1], ...color);
  }
  function floor(x, z, width, length, material, color, y = 0) {
    quad(material, color, [x,y,z], [x+width,y,z], [x+width,y,z+length], [x,y,z+length]);
  }
  function box(x, y, z, w, h, d, material, tint) {
    const a = [x,y,z], b = [x+w,y,z], c = [x+w,y+h,z], e = [x,y+h,z];
    const f = [x,y,z+d], g = [x+w,y,z+d], j = [x+w,y+h,z+d], k = [x,y+h,z+d];
    quad(material, tint, a,b,c,e);
    quad(material, shade(tint,.82), b,g,j,c);
    quad(material, shade(tint,.75), f,a,e,k);
    quad(material, shade(tint,.92), g,f,k,j);
    quad(material, shade(tint,1.12), e,c,j,k);
    quad(material, shade(tint,.53), f,g,b,a);
  }
  for (let z = -6; z < 47; z += 4) {
    for (let x = -12; x < 12; x += 4) floor(x, z, 4, 4, 'ground', shade(look.floor, .86 + .12*Math.cos(z*.7+x)));
    if (open && stage < 4) {
      for (const lineX of [-1.55, 1.55]) floor(lineX, z+.4, .065, 1.95, 'solid', [.63,.61,.44], .012);
    } else {
      for (const rail of [-wide+.24, wide-.29]) floor(rail, z, .085, 4, 'solid', [.40,.43,.39], .012);
    }
  }

  const ceiling = stage === 1 || alley;
  for (let i = 0; i < 10; i++) {
    const z = 2 + i*4.4;
    for (const side of [-1, 1]) {
      const edge = side < 0 ? -wide - .33 : wide + .04;
      if (!open || stage === 1 || stage === 4) {
        box(edge,0,z-.85,.29,stage === 1 ? 3.8 : 3.1,4.28,'metal',shade(look.metal, i%2 ? .98 : .84));
        box(edge - .1,0,z-.92,.44,2.95,.16,'solid',shade(look.metal,.39));
      } else {
        box(side < 0 ? -wide-.41 : wide,.0,z-.4,.48,.56,1.65,'metal',look.metal);
        floor(side < 0 ? -wide-.14 : wide-.11,z+.15,.1,.62,'solid',shade(lamp,.43),.018);
      }
      if (stage === 2 || (open && stage === 0)) {
        const cargoX = side < 0 ? -wide-3.4 : wide+.86;
        box(cargoX,0,z+.65,2.52, i%3 === 1 ? 3.7 : 2.24,2.75,'metal',
          i%2 ? shade(look.metal,.77) : [look.metal[0]*.79,look.metal[1]*.57,look.metal[2]*.53]);
      }
      if (stage === 3) {
        const sideX = side < 0 ? -wide-.18 : wide-.02;
        box(sideX,0,z,.13,1.02,.12,'metal',shade(look.metal,.9));
        box(sideX,.78,z,.073,.076,4.4,'solid',shade(look.metal,.63));
      }
    }
    if (ceiling) {
      floor(-wide, z-.85, 2*wide, 4.4, 'metal', shade(look.metal,.38), stage === 1 ? 3.7 : 3.0);
      box(-wide,.0,z, .18,3.5,.30,'metal',shade(look.metal,.7));
      box(-wide,stage === 1 ? 3.35 : 2.81,z,2*wide,.18,.33,'metal',look.metal);
      floor(-.62,z-.08,1.24,.166,'solid',lamp,stage === 1 ? 3.30 : 2.77);
    } else if (i%2 === 0) {
      const y = stage === 4 ? 3.35 : 3.85;
      for (const side of [-1,1]) box(side*wide,0,z,.21,y,.25,'metal',look.metal);
      box(-wide,y,z,2*wide+.21,.19,.26,'metal',shade(look.metal,.68));
      for (const x of [-wide+.45,wide-.71]) {
        box(x,y-.28,z-.16,.28,.16,.23,'solid',lamp);
        floor(x-.18,z-1,.62,2.1,'solid',shade(lamp,.23),.019);
      }
    }
  }
  if (alley) {
    box(-wide+.06,0,4.7,wide-.35,2.54,1.95,'metal',[.63,.81,.73]);
    box(-wide+.06,2.46,4.7,wide-.34,.085,1.97,'solid',[.35,.48,.36]);
  } else if (!open) {
    box(wide-1.03,0,3.6,.91,1.38,1.38,'metal',shade(look.metal,.9));
  }
  if (stage === 4) {
    box(-wide-.24,0,18.5,2*wide+.48,5,.25,'metal',look.metal);
    box(-1.65,0,18.25,3.3,3.75,.16,'metal',[.65,.66,.50]);
    box(-1.85,3.79,18.05,3.7,.135,.14,'solid',lamp);
    for (const x of [-1.92,1.8]) box(x,0,18.05,.12,3.78,.18,'solid',shade(lamp,.42));
  }
  return { batches, fog, lamp, actor: look.actor, height: look.height, alley,
    actorZ: alley ? 8.8 : stage === 4 ? 12.5 : open ? 14.2 : 11.6,
    distance: alley ? 6.1 : stage === 4 ? 8.15 : open ? 9.3 : 7.4 };
}
