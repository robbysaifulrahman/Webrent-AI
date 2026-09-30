"use client";

import { ENTRANCE, PARTITIONS, ROOM, ZONES } from "@/lib/office";

const COLORS = {
  floor: "#d8dbe2",
  wall: "#eef1f5",
  wallAccent: "#2f7d8c",
  wood: "#b07d4b",
  woodDark: "#8a5f36",
  metal: "#5b6470",
  screen: "#1b2230",
  seat: "#37424f",
  plantPot: "#b5643f",
  leaf: "#3f9d5a",
  lamp: "#fef3c7",
};

function Desk({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Daun meja + panel samping */}
      <mesh castShadow receiveShadow position={[0, 0.74, 0]}>
        <boxGeometry args={[2.2, 0.08, 1.1]} />
        <meshStandardMaterial color={COLORS.wood} flatShading />
      </mesh>
      {[
        [-1, -0.45],
        [1, -0.45],
        [-1, 0.45],
        [1, 0.45],
      ].map(([lx, lz], i) => (
        <mesh key={i} castShadow position={[lx, 0.37, lz]}>
          <boxGeometry args={[0.08, 0.74, 0.08]} />
          <meshStandardMaterial color={COLORS.metal} flatShading />
        </mesh>
      ))}
      {/* Monitor: kaki + leher + bezel + layar menyala */}
      <mesh castShadow position={[0.2, 0.79, -0.1]}>
        <boxGeometry args={[0.34, 0.03, 0.22]} />
        <meshStandardMaterial color={COLORS.metal} flatShading />
      </mesh>
      <mesh castShadow position={[0.2, 0.95, -0.12]}>
        <boxGeometry args={[0.06, 0.32, 0.05]} />
        <meshStandardMaterial color={COLORS.metal} flatShading />
      </mesh>
      <mesh castShadow position={[0.2, 1.18, -0.12]}>
        <boxGeometry args={[1.0, 0.6, 0.05]} />
        <meshStandardMaterial color="#0d1117" flatShading />
      </mesh>
      <mesh position={[0.2, 1.18, -0.09]}>
        <planeGeometry args={[0.9, 0.5]} />
        <meshStandardMaterial
          color="#9fd8ff"
          emissive="#5aa9e6"
          emissiveIntensity={0.85}
        />
      </mesh>
      {/* Keyboard + mouse */}
      <mesh castShadow position={[0.2, 0.79, 0.28]}>
        <boxGeometry args={[0.5, 0.025, 0.17]} />
        <meshStandardMaterial color="#e5e9ef" flatShading />
      </mesh>
      <mesh castShadow position={[0.62, 0.8, 0.28]}>
        <boxGeometry args={[0.07, 0.04, 0.11]} />
        <meshStandardMaterial color={COLORS.metal} flatShading />
      </mesh>
      {/* Mug */}
      <mesh castShadow position={[-0.55, 0.85, 0.2]}>
        <cylinderGeometry args={[0.05, 0.045, 0.11, 10]} />
        <meshStandardMaterial color={COLORS.wallAccent} flatShading />
      </mesh>
      {/* PC tower di bawah meja */}
      <mesh castShadow position={[-0.85, 0.28, -0.25]}>
        <boxGeometry args={[0.24, 0.56, 0.5]} />
        <meshStandardMaterial color={COLORS.seat} flatShading />
      </mesh>
      <mesh position={[-0.72, 0.35, -0.25]}>
        <boxGeometry args={[0.01, 0.03, 0.03]} />
        <meshStandardMaterial
          color="#7ff0b0"
          emissive="#2e9e63"
          emissiveIntensity={1.2}
        />
      </mesh>
    </group>
  );
}

function Chair({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Kaki bintang 5 + roda */}
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} rotation={[0, (i * Math.PI * 2) / 5, 0]}>
          <mesh castShadow position={[0, 0.07, 0.26]}>
            <boxGeometry args={[0.07, 0.05, 0.52]} />
            <meshStandardMaterial color={COLORS.metal} flatShading />
          </mesh>
          <mesh castShadow position={[0, 0.045, 0.5]}>
            <sphereGeometry args={[0.05, 8, 6]} />
            <meshStandardMaterial color="#1b2027" flatShading />
          </mesh>
        </group>
      ))}
      {/* Tiang gas-lift */}
      <mesh castShadow position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.36, 8]} />
        <meshStandardMaterial color={COLORS.metal} flatShading />
      </mesh>
      {/* Dudukan */}
      <mesh castShadow position={[0, 0.48, 0]}>
        <boxGeometry args={[0.55, 0.09, 0.52]} />
        <meshStandardMaterial color={COLORS.seat} flatShading />
      </mesh>
      {/* Sandaran tinggi dengan sedikit rebah */}
      <group position={[0, 0.52, -0.26]} rotation={[-0.1, 0, 0]}>
        <mesh castShadow position={[0, 0.35, 0]}>
          <boxGeometry args={[0.5, 0.62, 0.09]} />
          <meshStandardMaterial color={COLORS.seat} flatShading />
        </mesh>
        <mesh castShadow position={[0, 0.72, 0]}>
          <boxGeometry args={[0.3, 0.12, 0.08]} />
          <meshStandardMaterial color={COLORS.seat} flatShading />
        </mesh>
      </group>
      {/* Sandaran tangan kiri-kanan */}
      {[-0.31, 0.31].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh castShadow position={[0, 0.6, 0]}>
            <boxGeometry args={[0.05, 0.22, 0.05]} />
            <meshStandardMaterial color={COLORS.metal} flatShading />
          </mesh>
          <mesh castShadow position={[0, 0.72, 0.02]}>
            <boxGeometry args={[0.07, 0.04, 0.4]} />
            <meshStandardMaterial color={COLORS.seat} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.34, 0.26, 0.6, 8]} />
        <meshStandardMaterial color={COLORS.plantPot} flatShading />
      </mesh>
      <mesh castShadow position={[0, 0.95, 0]}>
        <icosahedronGeometry args={[0.6, 0]} />
        <meshStandardMaterial color={COLORS.leaf} flatShading />
      </mesh>
      <mesh castShadow position={[0.28, 1.4, 0.1]}>
        <icosahedronGeometry args={[0.38, 0]} />
        <meshStandardMaterial color={COLORS.leaf} flatShading />
      </mesh>
    </group>
  );
}

function Laptop({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow position={[0, 0.015, 0]}>
        <boxGeometry args={[0.36, 0.02, 0.24]} />
        <meshStandardMaterial color="#2b3440" flatShading />
      </mesh>
      <group position={[0, 0.02, -0.12]} rotation={[-0.35, 0, 0]}>
        <mesh castShadow position={[0, 0.11, 0]}>
          <boxGeometry args={[0.36, 0.23, 0.02]} />
          <meshStandardMaterial color="#0d1117" flatShading />
        </mesh>
        <mesh position={[0, 0.11, 0.012]}>
          <planeGeometry args={[0.32, 0.19]} />
          <meshStandardMaterial
            color="#9fd8ff"
            emissive="#5aa9e6"
            emissiveIntensity={0.7}
          />
        </mesh>
      </group>
    </group>
  );
}

function PartitionWall({ from, to }: { from: [number, number]; to: [number, number] }) {
  const [x1, z1] = from;
  const [x2, z2] = to;
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  const len = Math.hypot(x2 - x1, z2 - z1);
  const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
  return (
    <group position={[cx, 0, cz]}>
      <mesh castShadow receiveShadow position={[0, 1, 0]}>
        <boxGeometry args={alongX ? [len, 2, 0.15] : [0.15, 2, len]} />
        <meshStandardMaterial color={COLORS.wall} roughness={0.95} />
      </mesh>
      <mesh position={[0, 2.03, 0]}>
        <boxGeometry args={alongX ? [len, 0.06, 0.2] : [0.2, 0.06, len]} />
        <meshStandardMaterial color={COLORS.wallAccent} flatShading />
      </mesh>
    </group>
  );
}

const BOOK_COLORS = ["#e0483b", "#2563eb", "#2e9e63", "#d97706", "#9b59b6", "#0d9488"];

function Bookshelf({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Rangka: sisi kiri-kanan + atas + belakang */}
      {[-0.575, 0.575].map((x) => (
        <mesh key={x} castShadow position={[x, 1, 0]}>
          <boxGeometry args={[0.05, 2, 0.35]} />
          <meshStandardMaterial color={COLORS.woodDark} flatShading />
        </mesh>
      ))}
      <mesh castShadow position={[0, 1.975, 0]}>
        <boxGeometry args={[1.2, 0.05, 0.35]} />
        <meshStandardMaterial color={COLORS.woodDark} flatShading />
      </mesh>
      <mesh position={[0, 1, -0.15]}>
        <boxGeometry args={[1.15, 2, 0.03]} />
        <meshStandardMaterial color={COLORS.woodDark} flatShading />
      </mesh>
      {/* 3 rak + buku warna-warni */}
      {[0.35, 1, 1.65].map((y, shelf) => (
        <group key={y}>
          <mesh castShadow position={[0, y, 0]}>
            <boxGeometry args={[1.1, 0.04, 0.32]} />
            <meshStandardMaterial color={COLORS.wood} flatShading />
          </mesh>
          {[-0.4, -0.24, -0.08, 0.08, 0.24, 0.4].map((x, i) => (
            <mesh key={x} castShadow position={[x, y + 0.02 + [0.14, 0.11, 0.16, 0.12, 0.15, 0.1][i], 0]}>
              <boxGeometry args={[0.12, [0.28, 0.22, 0.32, 0.24, 0.3, 0.2][i], 0.2]} />
              <meshStandardMaterial
                color={BOOK_COLORS[(shelf * 2 + i) % BOOK_COLORS.length]}
                flatShading
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function ConferenceTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.72, 0]}>
        <boxGeometry args={[4.2, 0.12, 1.8]} />
        <meshStandardMaterial color={COLORS.woodDark} flatShading />
      </mesh>
      {[-1.4, 1.4].map((x) => (
        <mesh key={x} position={[x, 0.36, 0]}>
          <boxGeometry args={[0.5, 0.72, 1.2]} />
          <meshStandardMaterial color={COLORS.metal} flatShading />
        </mesh>
      ))}
      {/* 6 kursi: 3 utara menghadap selatan, 3 selatan menghadap utara */}
      {[-1.4, 0, 1.4].map((x) => (
        <Chair key={`n${x}`} position={[x, 0, -1.25]} rotation={0} />
      ))}
      {[-1.4, 0, 1.4].map((x) => (
        <Chair key={`s${x}`} position={[x, 0, 1.25]} rotation={Math.PI} />
      ))}
      {/* Laptop tengah: satu menghadap tiap sisi */}
      <Laptop position={[-0.7, 0.78, 0]} rotation={0} />
      <Laptop position={[0.7, 0.78, 0]} rotation={Math.PI} />
    </group>
  );
}

function Lamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[2.4, 0.12, 0.5]} />
        <meshStandardMaterial
          color={COLORS.lamp}
          emissive={COLORS.lamp}
          emissiveIntensity={0.9}
        />
      </mesh>
    </group>
  );
}

/**
 * Kantor low-poly 34×28 m yang dibangun penuh dari primitif R3F.
 * Dipakai sebagai fallback bila /models/office.glb tidak tersedia.
 * Lantai tiap zona departemen ditandai strip warna transparan.
 */
export function OfficeProcedural() {
  const { width, depth, wallHeight, wallThickness: t } = ROOM;
  const halfW = width / 2;
  const halfD = depth / 2;

  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={COLORS.floor} roughness={0.9} />
      </mesh>

      {/* Penanda lantai tiap zona departemen */}
      {Object.values(ZONES).map((zone) => (
        <mesh
          key={zone.label}
          position={[(zone.x1 + zone.x2) / 2, 0.014, (zone.z1 + zone.z2) / 2]}
        >
          <boxGeometry args={[zone.x2 - zone.x1 - 0.3, 0.012, zone.z2 - zone.z1 - 0.3]} />
          <meshStandardMaterial color={zone.color} transparent opacity={0.18} roughness={1} />
        </mesh>
      ))}

      <mesh castShadow receiveShadow position={[0, wallHeight / 2, -halfD]}>
        <boxGeometry args={[width + t, wallHeight, t]} />
        <meshStandardMaterial color={COLORS.wall} roughness={0.95} />
      </mesh>
      <mesh castShadow receiveShadow position={[-halfW, wallHeight / 2, 0]}>
        <boxGeometry args={[t, wallHeight, depth + t]} />
        <meshStandardMaterial color={COLORS.wall} roughness={0.95} />
      </mesh>
      <mesh castShadow receiveShadow position={[halfW, wallHeight / 2, 0]}>
        <boxGeometry args={[t, wallHeight, depth + t]} />
        <meshStandardMaterial color={COLORS.wall} roughness={0.95} />
      </mesh>

      {/* Dinding selatan RENDAH (1,5 m) + pintu utama di tengah.
          Dibuat rendah agar pandangan kamera orbit tidak terhalang. */}
      {[
        { x1: -halfW, x2: ENTRANCE.x1 },
        { x1: ENTRANCE.x2, x2: halfW },
      ].map(({ x1, x2 }, i) => (
        <mesh
          key={i}
          castShadow
          receiveShadow
          position={[(x1 + x2) / 2, 0.75, halfD]}
        >
          <boxGeometry args={[x2 - x1, 1.5, t]} />
          <meshStandardMaterial color={COLORS.wall} roughness={0.95} />
        </mesh>
      ))}

      {/* Portal pintu utama: 2 pilar + balok aksen */}
      {[-1.5, 1.5].map((x) => (
        <mesh key={x} castShadow position={[x, 1.6, halfD]}>
          <boxGeometry args={[0.3, 3.2, 0.3]} />
          <meshStandardMaterial color={COLORS.wallAccent} flatShading />
        </mesh>
      ))}
      <mesh castShadow position={[0, 3.1, halfD]}>
        <boxGeometry args={[3.6, 0.35, 0.4]} />
        <meshStandardMaterial color={COLORS.wallAccent} flatShading />
      </mesh>

      {/* Daun pintu kaca ganda (terbuka) */}
      {[
        { x: -0.62, r: 0.5 },
        { x: 0.62, r: -0.5 },
      ].map(({ x, r }, i) => (
        <group key={i} position={[x, 0, halfD]} rotation={[0, r, 0]}>
          <mesh position={[0, 1.1, 0]}>
            <boxGeometry args={[1.1, 2.2, 0.05]} />
            <meshStandardMaterial
              color="#bfe3ef"
              transparent
              opacity={0.35}
              roughness={0.15}
            />
          </mesh>
          <mesh position={[0, 1.1, 0.04]}>
            <boxGeometry args={[0.08, 0.5, 0.07]} />
            <meshStandardMaterial color={COLORS.metal} flatShading />
          </mesh>
        </group>
      ))}

      {/* Sumbu pintu utama steril: karpet lobby dihapus, x −3…3 z 8…14 kosong. */}

      <mesh position={[0, wallHeight - 0.15, -halfD + t]}>
        <boxGeometry args={[width, 0.28, 0.04]} />
        <meshStandardMaterial color={COLORS.wallAccent} />
      </mesh>

      <mesh position={[0, 1.7, -halfD + t + 0.03]}>
        <boxGeometry args={[4, 1.6, 0.06]} />
        <meshStandardMaterial color="#f6f8fb" />
      </mesh>
      <mesh position={[0, 1.7, -halfD + t + 0.07]}>
        <boxGeometry args={[3.9, 1.5, 0.02]} />
        <meshStandardMaterial color="#cfe8e6" />
      </mesh>

      {/* Baris meja utara terbuka: Operations / Finance / Analytics.
          (CEO punya meja di ruang privat.) Kursi menghadap utara ke monitor. */}
      {[-6, 1.2, 8.5].map((x, i) => (
        <group key={x}>
          <Desk position={[x, 0, -10.2]} />
          <Chair position={[x, 0, -9.3]} rotation={Math.PI} />
          {i < 2 && (
            <mesh position={[x + 3.6, 0.85, -10.2]}>
              <boxGeometry args={[0.08, 1.5, 2.4]} />
              <meshStandardMaterial color={COLORS.wallAccent} flatShading />
            </mesh>
          )}
        </group>
      ))}

      {/* Ruang Support 6×6: meja di sisi barat menghadap pintu timur;
          lemari di dinding selatan (bebas jalur pintu CEO di z=-8). */}
      <group>
        <Desk position={[-15.4, 0, -5]} rotation={Math.PI / 2} />
        <Chair position={[-14.5, 0, -5]} rotation={-Math.PI / 2} />
        <Bookshelf position={[-13, 0, -2.6]} rotation={0} />
        <Plant position={[-16.4, 0, -2.8]} />
      </group>

      {/* Meja Engineering / DevOps di eks-zona MKT (dinding timur, sejajar).
          Kursi di sisi barat meja: monitor menghadap barat ke arah kursi. */}
      <group>
        <Desk position={[16, 0, 2.5]} rotation={-Math.PI / 2} />
        <Chair position={[15.1, 0, 2.5]} rotation={Math.PI / 2} />
      </group>
      <group>
        <Desk position={[16, 0, 5.5]} rotation={-Math.PI / 2} />
        <Chair position={[15.1, 0, 5.5]} rotation={Math.PI / 2} />
      </group>

      {/* Partisi ruangan kolom barat + Meeting (dengan celah pintu) */}
      {PARTITIONS.map(([x1, z1, x2, z2], i) => (
        <PartitionWall key={i} from={[x1, z1]} to={[x2, z2]} />
      ))}

      {/* Meja UX & DOC hasil relokasi (sumbu pintu utama steril) */}
      <group>
        <Desk position={[-8, 0, 5]} />
        <Chair position={[-8, 0, 5.9]} rotation={Math.PI} />
        <Desk position={[-4, 0, 5]} />
        <Chair position={[-4, 0, 5.9]} rotation={Math.PI} />
        <Desk position={[4, 0, 5]} />
        <Chair position={[4, 0, 5.9]} rotation={Math.PI} />
        <Desk position={[8, 0, 5]} />
        <Chair position={[8, 0, 5.9]} rotation={Math.PI} />
      </group>

      {/* Workstation Sales & Marketing di ruang tersekat pojok timur laut,
          meja di dinding timur menghadap barat ke kursi */}
      <group>
        <Desk position={[16, 0, -12]} rotation={-Math.PI / 2} />
        <Chair position={[15.1, 0, -12]} rotation={Math.PI / 2} />
      </group>
      <group>
        <Desk position={[16, 0, -8]} rotation={-Math.PI / 2} />
        <Chair position={[15.1, 0, -8]} rotation={Math.PI / 2} />
      </group>

      {/* Ruang CEO 6×6: workstation di sisi barat, jalur dari pintu selatan kosong. */}
      <Desk position={[-15.4, 0, -11.5]} rotation={Math.PI / 2} />
      <Chair position={[-14.5, 0, -11.5]} rotation={-Math.PI / 2} />
      <Bookshelf position={[-16.2, 0, -9.5]} rotation={Math.PI / 2} />
      <Plant position={[-11.8, 0, -12.7]} />

      {/* Ruang Security 6×6: meja menghadap pintu timur. */}
      <Desk position={[-15, 0, 3.5]} />
      <Chair position={[-15, 0, 4.4]} rotation={Math.PI} />
      <Bookshelf position={[-15.8, 0, 6.4]} rotation={Math.PI} />
      <Plant position={[-16.3, 0, 1.8]} />

      {/* Ruang PM 6×6: jalur dari pintu utara tetap kosong; furnitur menepi ke sisi barat. */}
      <Desk position={[-15.4, 0, 11.5]} rotation={Math.PI / 2} />
      <Chair position={[-14.5, 0, 11.5]} rotation={-Math.PI / 2} />
      <Bookshelf position={[-11.7, 0, 11.5]} rotation={Math.PI / 2} />
      <Plant position={[-16.3, 0, 12.3]} />

      {/* Ruang Meeting 7×7 (tenggara): meja konferensi + layar dinding timur */}
      <ConferenceTable position={[13.5, 0, 10.5]} />
      <mesh castShadow position={[16.8, 1.8, 10.5]}>
        <boxGeometry args={[0.06, 1.3, 2.6]} />
        <meshStandardMaterial color="#0d1117" flatShading />
      </mesh>
      <mesh position={[16.76, 1.8, 10.5]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[2.4, 1.1]} />
        <meshStandardMaterial
          color="#9fd8ff"
          emissive="#5aa9e6"
          emissiveIntensity={0.7}
        />
      </mesh>

      {/* Koridor tengah barat–timur: area terbuka (tanpa karpet —
          menghindari z-fighting/clipping di persimpangan). */}

      <Plant position={[-16.4, 0, 0.4]} />
      <Plant position={[-8.5, 0, -13.1]} />
      <Plant position={[6.5, 0, 12.8]} />

      <Lamp position={[-6, wallHeight - 0.3, -10.2]} />
      <Lamp position={[7, wallHeight - 0.3, -10.2]} />
      <Lamp position={[-8, wallHeight - 0.3, 0]} />
      <Lamp position={[8, wallHeight - 0.3, 0]} />
      <Lamp position={[13.5, wallHeight - 0.3, 10.5]} />
      <Lamp position={[14.5, wallHeight - 0.3, -10]} />
      <Lamp position={[14.5, wallHeight - 0.3, 4]} />
    </group>
  );
}
