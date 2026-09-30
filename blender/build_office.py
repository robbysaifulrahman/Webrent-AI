"""
Generator kantor low-poly untuk webrent.my.id.

Menghasilkan model kantor 3D lalu mengekspornya ke GLB yang bisa
di-load oleh useGLTF pada aplikasi Next.js.

Cara pakai (Blender 3.x / 4.x):
    blender --background --python blender/build_office.py

Hasil:
    blender/office.glb  ->  salin ke  public/models/office.glb

Skala: 1 unit Blender = 1 meter. Origin di tengah lantai, lantai di Z=0.
Catatan: Blender memakai Z-up; exporter GLTF otomatis mengonversi ke Y-up,
sehingga di Three.js lantai berada di bidang XZ dan karakter berdiri di Y.
"""

import math
import os

import bpy

ROOM_WIDTH = 28.0
ROOM_DEPTH = 22.0
WALL_HEIGHT = 3.6
WALL_THICKNESS = 0.25

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_FILE = os.path.join(OUT_DIR, "office.glb")


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_material(name, color, roughness=0.8, metallic=0.0, emission=None):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission is not None and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 1.5
    return mat


def add_box(name, size, location, material, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0] / 2.0, size[1] / 2.0, size[2] / 2.0)
    obj.rotation_euler = rotation
    obj.data.materials.append(material)
    return obj


def add_cylinder(name, radius, depth, location, material, vertices=8):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=location
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(material)
    return obj


def add_ico(name, radius, location, material):
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=1, radius=radius, location=location
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(material)
    return obj


def build_room(materials):
    half_w = ROOM_WIDTH / 2.0
    half_d = ROOM_DEPTH / 2.0

    add_box(
        "Floor",
        (ROOM_WIDTH, ROOM_DEPTH, 0.2),
        (0, 0, -0.1),
        materials["floor"],
    )
    add_box(
        "Rug",
        (13.0, 9.0, 0.02),
        (0, 0.0, 0.01),
        materials["accent"],
    )

    t = WALL_THICKNESS
    add_box(
        "Wall_Back",
        (ROOM_WIDTH + t, t, WALL_HEIGHT),
        (0, -half_d, WALL_HEIGHT / 2.0),
        materials["wall"],
    )
    add_box(
        "Wall_Right",
        (t, ROOM_DEPTH + t, WALL_HEIGHT),
        (half_w, 0, WALL_HEIGHT / 2.0),
        materials["wall"],
    )
    add_box(
        "Wall_Left",
        (t, ROOM_DEPTH + t, WALL_HEIGHT),
        (-half_w, 0, WALL_HEIGHT / 2.0),
        materials["wall"],
    )
    add_box(
        "Accent_Trim",
        (ROOM_WIDTH, 0.28, 0.04),
        (0, -half_d + t, WALL_HEIGHT - 0.15),
        materials["accent"],
    )
    add_box(
        "Window_Frame",
        (4.0, 0.06, 1.6),
        (0, -half_d + t + 0.03, 1.7),
        materials["glass"],
    )


def rot2(dx, dy, a):
    """Putar offset (dx, dy) sebesar a radian terhadap sumbu Z (Blender)."""
    c, s = math.cos(a), math.sin(a)
    return (dx * c - dy * s, dx * s + dy * c)


def rbox(name, sx, sy, sz, dx, dy, z, mat, cx, cy, a):
    """Box relatif terhadap pusat (cx, cy) dengan rotasi a."""
    ox, oy = rot2(dx, dy, a)
    # Tukar ukuran x/y untuk putaran kelipatan ganjil 90 derajat
    quarter = round(a / (math.pi / 2)) % 2 == 1
    if quarter:
        sx, sy = sy, sx
    add_box(name, (sx, sy, sz), (cx + ox, cy + oy, z), mat, rotation=(0, 0, a))


def build_desk(materials, location, index, angle=0.0):
    x, y, z = location
    rbox(f"Desk_{index}_Top", 2.2, 1.1, 0.08, 0, 0, 0.74, materials["wood"], x, y, angle)
    for i, (dx, dy) in enumerate([(-1, -0.45), (1, -0.45), (-1, 0.45), (1, 0.45)]):
        ox, oy = rot2(dx, dy, angle)
        add_box(f"Desk_{index}_Leg_{i}", (0.08, 0.08, 0.74), (x + ox, y + oy, 0.37), materials["metal"])
    # Monitor: kaki + leher + bezel + layar menyala
    rbox(f"Desk_{index}_Base", 0.34, 0.22, 0.03, 0.2, -0.1, 0.79, materials["metal"], x, y, angle)
    rbox(f"Desk_{index}_Neck", 0.06, 0.05, 0.32, 0.2, -0.12, 0.95, materials["metal"], x, y, angle)
    rbox(f"Desk_{index}_Bezel", 1.0, 0.05, 0.6, 0.2, -0.12, 1.18, materials["screen"], x, y, angle)
    rbox(f"Desk_{index}_Screen", 0.9, 0.02, 0.5, 0.2, -0.09, 1.18, materials["glass"], x, y, angle)
    # Keyboard + mouse + mug + PC tower
    rbox(f"Desk_{index}_Keyboard", 0.5, 0.17, 0.025, 0.2, 0.28, 0.79, materials["wall"], x, y, angle)
    rbox(f"Desk_{index}_Mouse", 0.07, 0.11, 0.04, 0.62, 0.28, 0.8, materials["metal"], x, y, angle)
    ox, oy = rot2(-0.55, 0.2, angle)
    add_cylinder(f"Desk_{index}_Mug", 0.05, 0.11, (x + ox, y + oy, 0.85), materials["accent"])
    rbox(f"Desk_{index}_Tower", 0.24, 0.5, 0.56, -0.85, -0.25, 0.28, materials["seat"], x, y, angle)
    # Partisi antar meja (hanya baris utara)
    if index < 3:
        add_box(
            f"Partition_{index}",
            (0.08, 2.4, 1.5),
            (x + 3.0, y, 0.85),
            materials["accent"],
        )


def build_chair(materials, location, angle=0.0):
    """Kursi kantor menghadap arah +y lokal; putar angle (radian, sumbu Z)
    agar menghadap meja. angle=pi = menghadap -y."""
    x, y, z = location
    # Kaki bintang 5
    for i in range(5):
        add_box(
            "Chair_Leg",
            (0.07, 0.52, 0.05),
            (x, y, 0.07),
            materials["metal"],
            rotation=(0, 0, angle + i * 1.2566),
        )
    add_cylinder("Chair_Pole", 0.05, 0.36, (x, y, 0.26), materials["metal"])
    rbox("Chair_Seat", 0.55, 0.52, 0.09, 0, 0, 0.48, materials["seat"], x, y, angle)
    # Sandaran tinggi + headrest (di sisi -y lokal)
    rbox("Chair_Back", 0.5, 0.09, 0.62, 0, -0.26, 0.87, materials["seat"], x, y, angle)
    rbox("Chair_Head", 0.3, 0.08, 0.12, 0, -0.26, 1.24, materials["seat"], x, y, angle)
    # Sandaran tangan
    rbox("Chair_Arm_L", 0.05, 0.05, 0.22, -0.31, 0, 0.6, materials["metal"], x, y, angle)
    rbox("Chair_Arm_R", 0.05, 0.05, 0.22, 0.31, 0, 0.6, materials["metal"], x, y, angle)
    rbox("Chair_Pad_L", 0.07, 0.4, 0.04, -0.31, 0.02, 0.72, materials["seat"], x, y, angle)
    rbox("Chair_Pad_R", 0.07, 0.4, 0.04, 0.31, 0.02, 0.72, materials["seat"], x, y, angle)


def build_meeting_table(materials, location, index):
    x, y, z = location
    add_box(
        f"Meeting_{index}_Top",
        (2.6, 1.4, 0.12),
        (x, y, 0.72),
        materials["wood_dark"],
    )
    add_box(
        f"Meeting_{index}_Base",
        (0.5, 0.9, 0.72),
        (x, y, 0.36),
        materials["metal"],
    )
    # Laptop di depan tiap kursi (layar menghadap +y ke arah kursi)
    for j, lx in enumerate([x - 0.9, x + 0.9]):
        add_box(f"Meeting_{index}_Lap_{j}", (0.36, 0.24, 0.02), (lx, y + 0.25, 0.79), materials["seat"])
        add_box(f"Meeting_{index}_LapScr_{j}", (0.32, 0.02, 0.19), (lx, y + 0.24, 0.9), materials["glass"])
    build_chair(materials, (x - 0.9, y + 1.05, 0), math.pi)
    build_chair(materials, (x + 0.9, y + 1.05, 0), math.pi)


def build_plant(materials, location):
    x, y, z = location
    add_cylinder("Plant_Pot", 0.34, 0.6, (x, y, 0.3), materials["pot"])
    add_ico("Plant_Leaf_A", 0.6, (x, y, 0.95), materials["leaf"])
    add_ico("Plant_Leaf_B", 0.38, (x + 0.28, y + 0.1, 1.4), materials["leaf"])


def build_lamp(materials, location):
    add_box("Lamp", (2.4, 0.5, 0.12), location, materials["lamp"])


def build_entrance(materials):
    """Dinding selatan rendah + portal pintu utama + lobby."""
    half_d = ROOM_DEPTH / 2.0
    # Dinding selatan (rendah, 1,5 m) dengan celah pintu x -1,2..1,2
    add_box("Wall_South_L", (12.8, 0.25, 1.5), (-7.6, half_d, 0.75), materials["wall"])
    add_box("Wall_South_R", (12.8, 0.25, 1.5), (7.6, half_d, 0.75), materials["wall"])
    # Portal: 2 pilar + balok
    add_box("Portal_L", (0.3, 0.3, 3.2), (-1.5, half_d, 1.6), materials["accent"])
    add_box("Portal_R", (0.3, 0.3, 3.2), (1.5, half_d, 1.6), materials["accent"])
    add_box("Portal_Beam", (3.6, 0.4, 0.35), (0.0, half_d, 3.1), materials["accent"])
    # Daun pintu kaca
    add_box("Door_L", (1.1, 0.05, 2.2), (-0.62, half_d, 1.1), materials["glass"])
    add_box("Door_R", (1.1, 0.05, 2.2), (0.62, half_d, 1.1), materials["glass"])
    # Lobby: karpet + resepsionis + tanaman pengapit
    add_box("Lobby_Rug", (4.0, 2.6, 0.02), (0.0, 9.5, 0.01), materials["accent"])
    build_desk(materials, (-6.0, 9.5, 0), 50)
    build_chair(materials, (-6.0, 10.4, 0), math.pi)
    build_plant(materials, (-2.2, 10.2, 0))
    build_plant(materials, (2.2, 10.2, 0))


# DICOPOT SEMENTARA untuk redesign denah total (lihat PARTITIONS di src/lib/office.ts).
PARTITIONS: list = []


def build_partition(materials, index, x1, y1, x2, y2):
    cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0
    length = math.hypot(x2 - x1, y2 - y1)
    along_x = abs(x2 - x1) > abs(y2 - y1)
    size = (length, 0.15, 2.0) if along_x else (0.15, length, 2.0)
    add_box(f"Partition_{index}", size, (cx, cy, 1.0), materials["wall"])
    cap = (length, 0.2, 0.06) if along_x else (0.2, length, 0.06)
    add_box(f"PartitionCap_{index}", cap, (cx, cy, 2.03), materials["accent"])


def build_bookshelf(materials, location, index, angle=0.0):
    x, y, z = location
    rbox(f"Shelf_{index}_L", 0.05, 0.35, 2.0, -0.575, 0, 1.0, materials["wood_dark"], x, y, angle)
    rbox(f"Shelf_{index}_R", 0.05, 0.35, 2.0, 0.575, 0, 1.0, materials["wood_dark"], x, y, angle)
    rbox(f"Shelf_{index}_Top", 1.2, 0.35, 0.05, 0, 0, 1.975, materials["wood_dark"], x, y, angle)
    rbox(f"Shelf_{index}_Back", 1.15, 0.03, 2.0, 0, -0.15, 1.0, materials["wood_dark"], x, y, angle)
    for s, sy in enumerate([0.35, 1.0, 1.65]):
        rbox(f"Shelf_{index}_Plank_{s}", 1.1, 0.32, 0.04, 0, 0, sy, materials["wood"], x, y, angle)
        for b, bx in enumerate([-0.4, -0.24, -0.08, 0.08, 0.24, 0.4]):
            rbox(
                f"Shelf_{index}_Book_{s}_{b}", 0.12, 0.2, 0.26,
                bx, 0, sy + 0.15, materials["accent"], x, y, angle,
            )


def build_conference_table(materials, location, index):
    x, y, z = location
    add_box(f"Conf_{index}_Top", (4.2, 1.8, 0.12), (x, y, 0.72), materials["wood_dark"])
    add_box(f"Conf_{index}_BaseA", (0.5, 1.2, 0.72), (x - 1.4, y, 0.36), materials["metal"])
    add_box(f"Conf_{index}_BaseB", (0.5, 1.2, 0.72), (x + 1.4, y, 0.36), materials["metal"])
    for j, cx in enumerate([x - 1.4, x, x + 1.4]):
        add_box(f"Conf_{index}_Lap_{j}", (0.36, 0.24, 0.02), (cx, y, 0.79), materials["seat"])
        build_chair(materials, (cx, y - 1.25, 0), 0.0)
        build_chair(materials, (cx, y + 1.25, 0), math.pi)
    # Layar dinding timur
    add_box(f"Conf_{index}_Screen", (0.06, 2.6, 1.3), (13.8, y, 1.8), materials["screen"])


def main():
    reset_scene()

    materials = {
        "floor": make_material("Floor", (0.84, 0.86, 0.89)),
        "wall": make_material("Wall", (0.93, 0.95, 0.97)),
        "accent": make_material("Accent", (0.18, 0.49, 0.55)),
        "wood": make_material("Wood", (0.69, 0.49, 0.29)),
        "wood_dark": make_material("WoodDark", (0.54, 0.37, 0.21)),
        "metal": make_material("Metal", (0.36, 0.39, 0.44), metallic=0.6),
        "screen": make_material("Screen", (0.11, 0.13, 0.19)),
        "seat": make_material("Seat", (0.22, 0.26, 0.31)),
        "pot": make_material("Pot", (0.71, 0.39, 0.25)),
        "leaf": make_material("Leaf", (0.25, 0.62, 0.35)),
        "glass": make_material("Glass", (0.81, 0.91, 0.9), roughness=0.2),
        "lamp": make_material(
            "Lamp", (1.0, 0.95, 0.78), emission=(1.0, 0.95, 0.78)
        ),
    }

    build_room(materials)

    # Baris meja utara terbuka (koordinat Blender y = sumbu z di Three.js).
    # Kursi menghadap -y ke arah monitor (angle=pi).
    for i, x in enumerate([-5.0, 1.0, 7.0]):
        build_desk(materials, (x, -8.0, 0), i)
        build_chair(materials, (x, -7.1, 0), math.pi)

    # Meja Support terbuka. Rotasi Three.js +90° (sumbu Y) = -90°
    # dalam Blender (sumbu Z); kursi menghadap -x (angle=+90°).
    build_desk(materials, (-10.0, -2.5, 0), 10, angle=-math.pi / 2)
    build_chair(materials, (-9.1, -2.5, 0), math.pi / 2)

    # Meja tengah kanan (Engineering / DevOps)
    for i, z in enumerate([-2.5, 2.5]):
        build_desk(materials, (9.0, z, 0), 20 + i, angle=-math.pi / 2)
        build_chair(materials, (9.9, z, 0), math.pi / 2)

    # Partisi 4 ruangan
    for i, (x1, y1, x2, y2) in enumerate(PARTITIONS):
        build_partition(materials, i, x1, y1, x2, y2)

    # Workstation Sales / Marketing (menempel dinding timur)
    for i, z in enumerate([-3.0, 3.0]):
        build_desk(materials, (13.0, z, 0), 30 + i, angle=-math.pi / 2)
        build_chair(materials, (12.1, z, 0), math.pi / 2)

    # Ruang CEO (workstation menghadap timur, cermin prosedural)
    build_desk(materials, (-12.8, -9.1, 0), 40, angle=-math.pi / 2)
    build_chair(materials, (-11.9, -9.1, 0), math.pi / 2)
    build_bookshelf(materials, (-13.2, -7.2, 0), 40, angle=-math.pi / 2)
    build_plant(materials, (-9.5, -10.3, 0))

    # Ruang Security (selatan koridor)
    build_desk(materials, (-12.0, 3.0, 0), 41)
    build_chair(materials, (-12.0, 3.9, 0), math.pi)
    build_bookshelf(materials, (-13.2, 5.0, 0), 41, angle=math.pi)
    build_plant(materials, (-13.3, 1.7, 0))

    # Ruang PM (workstation menghadap timur, cermin prosedural)
    build_desk(materials, (-12.8, 9.3, 0), 42, angle=-math.pi / 2)
    build_chair(materials, (-11.9, 9.3, 0), math.pi / 2)
    build_bookshelf(materials, (-9.5, 9.6, 0), 42, angle=-math.pi / 2)
    build_plant(materials, (-9.5, 10.2, 0))

    # Meja meeting selatan (terbuka, digeser dari sumbu pintu utama)
    build_meeting_table(materials, (-7.6, 7.5, 0), 0)
    build_meeting_table(materials, (-4.7, 7.5, 0), 1)
    build_meeting_table(materials, (4.5, 7.5, 0), 2)

    # Ruang Meeting
    build_conference_table(materials, (11.0, 8.0, 0), 0)

    # Pintu utama + lobby
    build_entrance(materials)

    # Pod kerja (4 meja back-to-back) di selatan koridor, cermin prosedural.
    for i, dz in enumerate([-1.5, 1.5]):
        z = dz + 4.5
        build_desk(materials, (-1.3, z, 0), 60 + i, angle=math.pi / 2)
        build_chair(materials, (-2.2, z, 0), -math.pi / 2)
        build_desk(materials, (1.3, z, 0), 70 + i, angle=-math.pi / 2)
        build_chair(materials, (2.2, z, 0), math.pi / 2)

    build_plant(materials, (-7.0, -10.3, 0))
    build_plant(materials, (13.0, -10.0, 0))
    build_plant(materials, (5.5, 10.3, 0))

    build_lamp(materials, (-7.0, -8.0, WALL_HEIGHT - 0.3))
    build_lamp(materials, (7.0, -8.0, WALL_HEIGHT - 0.3))
    build_lamp(materials, (-7.0, 0.0, WALL_HEIGHT - 0.3))
    build_lamp(materials, (7.0, 0.0, WALL_HEIGHT - 0.3))
    build_lamp(materials, (0.0, 7.5, WALL_HEIGHT - 0.3))

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bpy.ops.export_scene.gltf(
        filepath=OUT_FILE,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
    )

    print(f"\n[OK] Kantor diekspor ke: {OUT_FILE}")
    print("     Salin file tersebut ke public/models/office.glb\n")


if __name__ == "__main__":
    main()
