# public/models

Taruh model hasil export Blender di sini dengan nama `office.glb`.

Aplikasi akan otomatis memuatnya lewat `useGLTF('/models/office.glb')`.
Jika file ini tidak ada, aplikasi memakai kantor prosedural (fallback),
jadi proyek tetap berjalan tanpa error.

Cara membuat:
    blender --background --python blender/build_office.py
