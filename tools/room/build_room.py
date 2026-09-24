"""Original procedural command-room set, authored in runtime Y-up coordinates.

Run with Blender --background --python build_room.py. All shapes are original
geometry based on the user's supplied architectural reference. No image assets.
"""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parent
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def p(v):
    return Vector((v[0], -v[2], v[1]))

def mat(name, color, metallic=0, rough=.45, emission=None, strength=1):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    n = m.node_tree.nodes.get('Principled BSDF')
    n.inputs['Base Color'].default_value = (*color, 1)
    n.inputs['Metallic'].default_value = metallic
    n.inputs['Roughness'].default_value = rough
    if emission:
        n.inputs['Emission Color'].default_value = (*emission, 1)
        n.inputs['Emission Strength'].default_value = strength
    return m

M = {
    'shell': mat('Porcelain alloy | shell', (.47,.55,.62), .48,.38),
    'ivory': mat('Ceramic silver | panels', (.72,.78,.83), .32,.35),
    'floor': mat('Brushed titanium | floor', (.24,.29,.34), .52,.44),
    'trim': mat('Graphite | frame and joints', (.048,.071,.088), .65,.38),
    'black': mat('Obsidian | consoles', (.009,.019,.032), 0,.52),
    'seat': mat('Slate fabric | chair', (.145,.19,.24), .05,.65),
    'glow': mat('Frosted ceiling | emission', (.68,.80,.90), .1,.28, (.64,.80,1), 2.2),
    'cyan': mat('Ice blue | status emission', (.12,.43,.64), .2,.34, (.14,.52,.82), 2.5),
    'soft': mat('Dim display | emission', (.04,.14,.20), .15,.45, (.045,.17,.26), .9),
    'amber': mat('Warm amber | status', (.8,.4,.09), .15,.4, (1,.4,.055), 1.8),
}
M['black'].node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value=.08
parts=[]

def finish(obj, name, material, bevel=0):
    obj.name=name
    obj.data.materials.append(M[material])
    if bevel:
        mod=obj.modifiers.new('Machined soft edges','BEVEL')
        mod.width=bevel
        mod.segments=3
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
        for f in obj.data.polygons: f.use_smooth=True
        mod=obj.modifiers.new('Face normals','WEIGHTED_NORMAL')
        mod.keep_sharp=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    parts.append(obj)
    return obj

def box(name, center, size, material, bevel=0, yaw=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=p(center))
    o=bpy.context.object
    o.dimensions=(size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.rotation_euler.z=yaw
    return finish(o,name,material,bevel)

def beam(name, a, b, width, depth, material, bevel=.025):
    av,bv=p(a),p(b)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(av+bv)/2)
    o=bpy.context.object
    o.dimensions=(width,depth,(bv-av).length)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.rotation_euler=(bv-av).to_track_quat('Z','Y').to_euler()
    return finish(o,name,material,bevel)

def poly(name, verts, faces, material, bevel=0):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata([p(v) for v in verts],[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj,name,material,bevel)

def cyl(name, center, radius, depth, material, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=p(center))
    o=bpy.context.object
    return finish(o,name,material,.018)

def strip(name, points, width, depth, material):
    for i in range(len(points)-1): beam(name+f' {i}',points[i],points[i+1],width,depth,material,.008)

# Floor is a physical slab at y=0, never an image plane.
box('Floor slab',(0,-.10,0),(12.7,.20,10.7),'floor',.07)
box('Rear service floor',(0,.003,-3.08),(10.6,.008,3.55),'shell',.04)
box('Central aisle',(0,.006,1.13),(7.3,.012,6.35),'floor',.035)
for x in [-4.65,-2.35,0,2.35,4.65]:
    box('Longitudinal floor seam',(x,.011,.17),(.013,.009,9.8),'trim')
for z in [-4.6,-2.2,.2,2.6,4.9]:
    box('Cross floor seam',(0,.012,z),(11.7,.008,.014),'trim')
for side in [-1,1]:
    box('Aisle light',(side*4.9,.014,.88),(.025,.01,6.95),'soft',.006)
    for z in [-1.9,1.5,4.25]:
        box('Aisle marker',(side*4.72,.018,z),(.22,.013,.075),'cyan',.007)

# Open-front shell with angled shoulders and deliberately no front wall.
box('Rear wall',(0,2.38,-5.02),(11.72,4.78,.24),'shell',.08)
box('Rear upper vault closure',(0,5.12,-5.02),(9.70,.82,.24),'shell',.04)
for side in [-1,1]:
    box('Side lower shell',(side*6.06,1.93,-.05),(.24,3.86,10.05),'shell',.075)
    verts=[(side*6.18,3.78,-5.1),(side*4.85,5.75,-5.1),(side*4.85,5.75,4.8),(side*6.18,3.78,4.8),
           (side*5.94,3.78,-5.1),(side*4.7,5.55,-5.1),(side*4.7,5.55,4.8),(side*5.94,3.78,4.8)]
    poly('Angled upper shoulder',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'shell',.04)
    box('Lower wall inset',(side*5.918,.55,-.12),(.022,.9,9.72),'ivory',.018)
    box('Wall light',(side*5.889,.47,-.1),(.025,.055,9.78),'glow',.01)
    for z in [-3.5,-.65,2.25]:
        box('Side wall graphite recess',(side*5.919,2.35,z),(.035,1.82,2.38),'trim',.055)
        box('Side wall ceramic panel',(side*5.889,2.35,z),(.042,1.68,2.23),'ivory',.04)
        for off in [-.56,-.39,-.22]:
            box('Side wall cooling slit',(side*5.86,2.68+off,z),(.02,.042,1.58),'trim',.012)
        box('Side panel status',(side*5.854,1.81,z+.74),(.022,.1,.2),'cyan',.014)

# Broad sculpted arches and back-lit roof coffers; no roof at front camera entry.
arch=[(-5.92,.13),(-5.92,3.4),(-5.52,4.22),(-4.62,5.44),(4.62,5.44),(5.52,4.22),(5.92,3.4),(5.92,.13)]
for ri,z in enumerate([-4.78,-1.68,1.44,4.56]):
    for i in range(len(arch)-1):
        a,b=arch[i],arch[i+1]
        beam(f'Vault frame {ri}.{i}',(a[0],a[1],z),(b[0],b[1],z),.26,.24,'shell',.05)
    if ri<3:
        for side in [-1,1]:
            strip('Arch light',[(side*5.75,1.0,z+.14),(side*5.75,3.34,z+.14),(side*5.36,4.13,z+.14),(side*4.56,5.26,z+.14)],.025,.022,'glow')
for rz,(z0,z1) in enumerate([(-4.64,-1.85),(-1.54,1.27),(1.59,4.42)]):
    for ix,(x0,x1) in enumerate([(-4.45,-1.56),(-1.43,1.43),(1.56,4.45)]):
        box(f'Roof coffer {rz}.{ix}',((x0+x1)/2,5.565,(z0+z1)/2),(x1-x0,.10,z1-z0),'trim',.045)
        box(f'Illuminated roof {rz}.{ix}',((x0+x1)/2,5.499,(z0+z1)/2),(x1-x0-.12,.03,z1-z0-.12),'glow',.033)

# Rear panoramic monitor bank: faceted concave architectural geometry.
box('Rear wall light',(0,.5,-4.883),(11.8,.055,.035),'glow',.012)
box('Rear console plinth',(0,.26,-4.53),(10.55,.43,.54),'ivory',.07)
for idx in range(7):
    x=(idx-3)*1.49
    z=-4.57+.045*x*x
    yaw=-math.atan(.09*x)
    def local(lx,ly,lz):
        return (x+lx*math.cos(yaw)+lz*math.sin(yaw),ly,z-lx*math.sin(yaw)+lz*math.cos(yaw))
    box('Monitor housing',local(0,2.50,0),(1.46,1.52,.20),'trim',.075,yaw)
    box('Monitor screen',local(0,2.50,.112),(1.32,1.34,.032),'black',.035,yaw)
    box('Screen header',local(-.025,3.04,.135),(1.16,.018,.008),'cyan',.004,yaw)
    box('Screen baseline',local(-.025,2.01,.135),(1.16,.014,.008),'soft',.004,yaw)
    for row in range(10):
        yy=2.88-row*.076
        for col in range(3):
            ll=.17+((row*7+idx*3+col*5)%7)*.022
            xx=-.53+col*.39
            box('Display telemetry',local(xx+ll/2,yy,.136),(ll,.009,.008),'soft',.002,yaw)
    for bar in range(13):
        h=.035+((bar*11+idx*3)%7)*.019
        box('Display chart',local(-.57+bar*.046,2.15+h/2,.138),(.023,h,.008),'soft',.002,yaw)
    box('Live indicator',local(.51,2.15,.14),(.046,.046,.012),'amber',.009,yaw)

# Single broad console desk, floating slab and angled support legs.
box('Desk lower edge',(0,1.38,-3.25),(8.88,.13,1.17),'trim',.085)
box('Desk ceramic top',(0,1.46,-3.25),(8.78,.11,1.15),'ivory',.06)
box('Desk black inset',(0,1.522,-3.34),(7.97,.025,.69),'black',.04)
box('Desk edge underlight',(0,1.33,-2.655),(8.22,.028,.023),'soft',.01)
for side in [-1,1]:
    beam('Splayed desk leg',(side*3.33,.11,-3.15),(side*2.94,1.34,-3.18),.23,.62,'shell',.065)
    box('Desk foot',(side*3.4,.075,-3.19),(.84,.14,.91),'trim',.045)
    box('Desk control panel',(side*2.35,1.54,-3.13),(1.49,.023,.43),'trim',.035)
    for n in range(7):
        box('Desk controls',(side*2.35+(n-3)*.17,1.556,-3.10),(.09,.014,.1),'soft',.011)
    box('Desk status rail',(side*2.35,1.558,-3.30),(1.24,.012,.011),'cyan',.004)

# Distinctive central captain chair. Dimensions keep the chibi hero dominant.
cyl('Chair base',(0,.075,-2.09),.60,.12,'trim',64)
cyl('Chair base trim',(0,.141,-2.09),.48,.027,'shell',48)
cyl('Chair pedestal',(0,.43,-2.09),.105,.56,'shell',32)
box('Chair underseat',(0,.70,-2.09),(1.03,.17,.97),'trim',.095)
box('Chair cushion',(0,.812,-2.03),(.89,.16,.79),'seat',.09)
# Rounded tapered back shell, leaning backward.
verts=[(-.58,.72,-2.53),(.58,.72,-2.53),(.43,1.84,-2.65),(-.43,1.84,-2.65),
       (-.50,.76,-2.36),(.50,.76,-2.36),(.36,1.78,-2.48),(-.36,1.78,-2.48)]
poly('Chair back ceramic',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'ivory',.075)
verts=[(-.42,.89,-2.343),(.42,.89,-2.343),(.31,1.70,-2.462),(-.31,1.70,-2.462),
       (-.42,.89,-2.375),(.42,.89,-2.375),(.31,1.70,-2.49),(-.31,1.70,-2.49)]
poly('Chair back upholstery',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'seat',.045)
for side in [-1,1]:
    beam('Chair angled arm',(side*.49,.77,-1.8),(side*.66,1.03,-1.97),.1,.42,'shell',.03)
    box('Chair armrest',(side*.60,1.052,-2.08),(.18,.1,.64),'trim',.065)

# Original geometry only. Merge meshes by material, keeping one draw call each.
for obj in parts:
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.select_set(False)
merged=[]
material_groups={key:[o for o in parts if o.data.materials and o.data.materials[0]==material] for key,material in M.items()}
for key,objs in material_groups.items():
    if not objs: continue
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objs: obj.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    bpy.ops.object.join()
    obj=bpy.context.object
    obj.name='Room • '+key
    merged.append(obj)
    obj['source']='Original parameterized architectural geometry'

layout={
    'version':1,'units':'meters','up':'Y','floorY':0,
    'name':'Robin Command Room','front':'+Z',
    'walkBounds':{'minX':-5.45,'maxX':5.45,'minZ':-4.34,'maxZ':4.82},
    'spawn':{'x':0,'z':1.5},
    'clearForeground':{'minX':-3.5,'maxX':3.5,'minZ':-1.05,'maxZ':4.82},
    'colliders':[
        {'id':'console-desk','type':'rect','minX':-4.52,'maxX':4.52,'minZ':-3.89,'maxZ':-2.59},
        {'id':'captain-chair','type':'circle','x':0,'z':-2.09,'radius':.79},
        {'id':'rear-console','type':'rect','minX':-5.37,'maxX':5.37,'minZ':-4.9,'maxZ':-4.2},
    ],
    'lighting':{'note':'Emissive surfaces are decorative; illuminate with runtime lights.',
        'suggestedKeyPosition':[0,5,1], 'suggestedFillPosition':[4,3,4], 'suggestedRimPosition':[-3,4,-3]},
    'camera':{'front':[0,3.5,11.2],'lookAt':[0,1.9,-1]},
    'notes':['Open front and walkable floor; shell/ceiling are real meshes.',
        'No collider for overhead beams. Character radius must be applied to bounds and colliders.',
        'Back console gap is not a traversal route. All meshes use procedural solid materials, no textures.']
}
(OUT/'room-layout.json').write_text(json.dumps(layout,indent=2)+'\n',encoding='utf-8')
bpy.ops.object.select_all(action='DESELECT')
for o in merged:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'command-room.glb'),export_format='GLB',use_selection=True,export_yup=True,
    export_apply=True,export_cameras=False,export_lights=False,export_animations=False,export_extras=False)

def area(name, location, target, energy, color, size):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=energy
    data.color=color
    data.shape='DISK'
    data.size=size
    obj=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    obj.location=p(location)
    obj.rotation_euler=(p(target)-obj.location).to_track_quat('-Z','Y').to_euler()

area('Roof softbox',(0,5.12,.1),(0,0,0),1800,(.71,.84,1),8)
area('Entrance softbox',(0,4.5,8),(0,1,-3),2000,(.85,.92,1),8)
area('Rear bounce',(-4,3,-3.8),(0,1,0),950,(.38,.68,1),4)
area('Warm edge',(5.5,3.7,.5),(0,1.5,0),700,(1,.8,.59),3)
world=bpy.data.worlds.new('Studio ambient')
bpy.context.scene.world=world
world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.2,.26,.35,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.35
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=16
scene.cycles.use_denoising=True
scene.render.resolution_x=1200
scene.render.resolution_y=788
scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.view_settings.exposure=-.7
scene.render.image_settings.file_format='PNG'
bpy.ops.object.camera_add()
cam=bpy.context.object
cam.name='Room QA camera'
cam.data.lens=32
scene.camera=cam

def render(name,location,target):
    cam.location=p(location)
    cam.rotation_euler=(p(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/name)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'command-room.blend'))
    bpy.ops.render.render(write_still=True)

stats={'meshCount':len(merged),'materialCount':len(M),'vertexCount':sum(len(o.data.vertices) for o in merged),
    'triangleCount':sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in merged),
    'glbBytes':(OUT/'command-room.glb').stat().st_size,'textures':0,
    'source':'Original geometry authored specifically for this project from user reference.'}
(OUT/'room-report.json').write_text(json.dumps(stats,indent=2)+'\n',encoding='utf-8')
print('ROOM_REPORT',json.dumps(stats))
render('room-front.png',(0,3.05,11.8),(0,2.13,-1.65))
render('room-diagonal.png',(4.8,3.5,8.8),(0,1.9,-1.9))
