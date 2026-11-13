/**
 * A small but structurally valid PE32+ (x86-64, GUI) image, built byte by byte for the
 * /malware/ hexdump. Every header field is real and the pieces agree with each other:
 *
 *   DOS header (e_lfanew → 0x80) · DOS stub · "PE\0\0" · COFF header (AMD64, 5 sections)
 *   PE32+ optional header with 16 data directories · section table
 *   .text  @ file 0x400  : a real x64 function that calls VirtualAllocEx through the IAT
 *   .rdata @ file 0x2000 : IAT, import descriptors, lookup table, hint/name table, DLL names
 *
 * Output is formatted exactly like `hexdump -C`, including "*" for repeated lines.
 */

export type Mark = "" | "hl" | "sus";
export type DumpLine =
  | { kind: "cmd"; text: string }
  | { kind: "row"; off: string; bytes: { h: string; m: Mark }[]; ascii: { c: string; m: Mark }[] }
  | { kind: "star" }
  | { kind: "end"; off: string };

const SIZE = 0x3600;
const buf = new Uint8Array(SIZE);
const marks: Mark[] = new Array(SIZE).fill("");

const mark = (at: number, len: number, m: Mark) => {
  for (let i = 0; i < len; i++) marks[at + i] = m;
};
const u8 = (at: number, v: number) => (buf[at] = v & 0xff);
const u16 = (at: number, v: number) => (u8(at, v), u8(at + 1, v >> 8));
const u32 = (at: number, v: number) => (u16(at, v & 0xffff), u16(at + 2, (v >>> 16) & 0xffff));
const u64 = (at: number, v: bigint) => (u32(at, Number(v & 0xffffffffn)), u32(at + 4, Number(v >> 32n)));
const raw = (at: number, bytes: number[]) => bytes.forEach((b, i) => u8(at + i, b));
const ascii = (at: number, s: string, m: Mark = "") => {
  raw(at, [...s].map((c) => c.charCodeAt(0)));
  if (m) mark(at, s.length, m);
};

/* ── Layout ── */
const E_LFANEW = 0x80;
const FILE_ALIGN = 0x200;
const SECT_ALIGN = 0x1000;
const IMAGE_BASE = 0x140000000n;

const sections = [
  { name: ".text", vsize: 0x1a3c, va: 0x1000, rsize: 0x1c00, raw: 0x0400, chr: 0x60000020 },
  { name: ".rdata", vsize: 0x0e10, va: 0x3000, rsize: 0x1000, raw: 0x2000, chr: 0x40000040 },
  { name: ".data", vsize: 0x0640, va: 0x4000, rsize: 0x0200, raw: 0x3000, chr: 0xc0000040 },
  { name: ".pdata", vsize: 0x01f8, va: 0x5000, rsize: 0x0200, raw: 0x3200, chr: 0x40000040 },
  { name: ".rsrc", vsize: 0x01e0, va: 0x6000, rsize: 0x0200, raw: 0x3400, chr: 0x40000040 },
];
const rdata = sections[1];
const fileOf = (rva: number) => rva - rdata.va + rdata.raw; // only used for .rdata

/* ── DOS header + stub ── */
ascii(0x00, "MZ", "hl");
raw(0x02, [0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00, 0xb8, 0x00]);
u16(0x18, 0x0040); // e_lfarlc
u32(0x3c, E_LFANEW);
mark(0x3c, 4, "hl");
raw(0x40, [0x0e, 0x1f, 0xba, 0x0e, 0x00, 0xb4, 0x09, 0xcd, 0x21, 0xb8, 0x01, 0x4c, 0xcd, 0x21]);
ascii(0x4e, "This program cannot be run in DOS mode.", "hl");
raw(0x75, [0x0d, 0x0d, 0x0a, 0x24]);

/* ── NT headers ── */
ascii(E_LFANEW, "PE", "hl");
mark(E_LFANEW + 2, 2, "hl");
const coff = E_LFANEW + 4;
u16(coff + 0, 0x8664); // Machine: AMD64
mark(coff, 2, "hl");
u16(coff + 2, sections.length);
u32(coff + 4, 0x6538f1a2); // TimeDateStamp
u16(coff + 16, 0xf0); // SizeOfOptionalHeader
u16(coff + 18, 0x0023); // RELOCS_STRIPPED | EXECUTABLE_IMAGE | LARGE_ADDRESS_AWARE

const opt = coff + 20; // 0x98
u16(opt + 0x00, 0x020b); // PE32+
mark(opt, 2, "hl");
u8(opt + 0x02, 14); // linker 14.36
u8(opt + 0x03, 36);
u32(opt + 0x04, 0x1c00); // SizeOfCode
u32(opt + 0x08, 0x1600); // SizeOfInitializedData
u32(opt + 0x10, 0x1360); // AddressOfEntryPoint
u32(opt + 0x14, 0x1000); // BaseOfCode
u64(opt + 0x18, IMAGE_BASE);
u32(opt + 0x20, SECT_ALIGN);
u32(opt + 0x24, FILE_ALIGN);
u16(opt + 0x28, 6); // MajorOperatingSystemVersion
u16(opt + 0x30, 6); // MajorSubsystemVersion
u32(opt + 0x38, 0x7000); // SizeOfImage
u32(opt + 0x3c, 0x400); // SizeOfHeaders
u16(opt + 0x44, 2); // Subsystem: WINDOWS_GUI
u16(opt + 0x46, 0x8100); // NX_COMPAT | TERMINAL_SERVER_AWARE
u64(opt + 0x48, 0x100000n); // SizeOfStackReserve
u64(opt + 0x50, 0x1000n); // SizeOfStackCommit
u64(opt + 0x58, 0x100000n); // SizeOfHeapReserve
u64(opt + 0x60, 0x1000n); // SizeOfHeapCommit
u32(opt + 0x6c, 16); // NumberOfRvaAndSizes

/* ── .rdata: imports ── */
const imports = [
  {
    dll: "KERNEL32.dll",
    fns: [
      { name: "VirtualAllocEx", hint: 0x05e0 },
      { name: "WriteProcessMemory", hint: 0x0632 },
      { name: "CreateRemoteThread", hint: 0x00f5 },
      { name: "IsDebuggerPresent", hint: 0x0389 },
    ],
  },
  { dll: "WININET.dll", fns: [{ name: "InternetOpenUrlA", hint: 0x009c }] },
];

const IAT_RVA = 0x3000;
const DESC_RVA = 0x39c0;
const INT_RVA = 0x3a00;
const descSize = (imports.length + 1) * 20;

// thunk tables (IAT and INT hold the same values on disk, i.e. unbound)
let iat = IAT_RVA;
let int = INT_RVA;
const thunkAt = imports.map((imp) => {
  const at = { iat, int };
  const n = (imp.fns.length + 1) * 8;
  iat += n;
  int += n;
  return at;
});
const IAT_SIZE = iat - IAT_RVA;

// hint/name entries, then DLL names
let cursor = int;
const nameRva = imports.map((imp) =>
  imp.fns.map((fn) => {
    const rva = cursor;
    u16(fileOf(rva), fn.hint);
    ascii(fileOf(rva) + 2, fn.name, "sus");
    cursor += 2 + fn.name.length + 1;
    if (cursor % 2) cursor++;
    return rva;
  })
);
const dllRva = imports.map((imp) => {
  const rva = cursor;
  ascii(fileOf(rva), imp.dll, "hl");
  cursor += imp.dll.length + 1;
  if (cursor % 2) cursor++;
  return rva;
});
export const RDATA_DUMP_END = fileOf(Math.ceil(cursor / 16) * 16);

imports.forEach((imp, i) => {
  // descriptor: OriginalFirstThunk, TimeDateStamp, ForwarderChain, Name, FirstThunk
  const d = fileOf(DESC_RVA + i * 20);
  u32(d + 0, thunkAt[i].int);
  u32(d + 12, dllRva[i]);
  u32(d + 16, thunkAt[i].iat);
  imp.fns.forEach((_, j) => {
    u64(fileOf(thunkAt[i].iat) + j * 8, BigInt(nameRva[i][j]));
    u64(fileOf(thunkAt[i].int) + j * 8, BigInt(nameRva[i][j]));
  });
});

/* ── data directories ── */
const dir = (i: number, rva: number, size: number) => (u32(opt + 0x70 + i * 8, rva), u32(opt + 0x74 + i * 8, size));
dir(1, DESC_RVA, descSize); // IMPORT
dir(2, 0x6000, 0x01e0); // RESOURCE
dir(3, 0x5000, 0x01f8); // EXCEPTION
dir(12, IAT_RVA, IAT_SIZE); // IAT

/* ── section table ── */
const secTable = opt + 0xf0; // 0x188
sections.forEach((s, i) => {
  const h = secTable + i * 40;
  ascii(h, s.name, "hl");
  u32(h + 8, s.vsize);
  u32(h + 12, s.va);
  u32(h + 16, s.rsize);
  u32(h + 20, s.raw);
  u32(h + 36, s.chr);
});

/* ── .text: allocate RWX memory in another process via the IAT ── */
const code: number[] = [];
const textRva = sections[0].va;
const emit = (...b: number[]) => code.push(...b);
const le32 = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff];
emit(0x48, 0x89, 0x5c, 0x24, 0x08); //   mov  [rsp+8], rbx
emit(0x57); //                           push rdi
emit(0x48, 0x83, 0xec, 0x30); //         sub  rsp, 30h
emit(0x33, 0xd2); //                     xor  edx, edx              ; lpAddress = NULL
emit(0x41, 0xb8, ...le32(0x1000)); //    mov  r8d, 1000h            ; dwSize
emit(0x41, 0xb9, ...le32(0x3000)); //    mov  r9d, 3000h            ; MEM_COMMIT|MEM_RESERVE
emit(0xc7, 0x44, 0x24, 0x20, ...le32(0x40)); // mov dword [rsp+20h], 40h ; PAGE_EXECUTE_READWRITE
const callNext = textRva + code.length + 6;
emit(0xff, 0x15, ...le32(thunkAt[0].iat - callNext)); // call [VirtualAllocEx]
emit(0x48, 0x8b, 0xd8); //               mov  rbx, rax
emit(0x48, 0x8b, 0xc3); //               mov  rax, rbx
emit(0x48, 0x8b, 0x5c, 0x24, 0x40); //   mov  rbx, [rsp+40h]
emit(0x48, 0x83, 0xc4, 0x30); //         add  rsp, 30h
emit(0x5f); //                           pop  rdi
emit(0xc3); //                           ret
while (code.length % 16) emit(0xcc); //  int3 padding
raw(sections[0].raw, code);
export const TEXT_DUMP_END = sections[0].raw + code.length;

/* ── hexdump -C formatting ── */
const hex = (n: number, w: number) => n.toString(16).padStart(w, "0");

function hexdump(start: number, end: number): DumpLine[] {
  const out: DumpLine[] = [];
  let prev = "";
  let starred = false;
  for (let off = start; off < end; off += 16) {
    const slice = Array.from(buf.slice(off, Math.min(off + 16, end)));
    const key = slice.join(",");
    if (key === prev && off !== start) {
      if (!starred) out.push({ kind: "star" });
      starred = true;
      continue;
    }
    prev = key;
    starred = false;
    out.push({
      kind: "row",
      off: hex(off, 8),
      bytes: slice.map((b, i) => ({ h: hex(b, 2), m: marks[off + i] })),
      ascii: slice.map((b, i) => ({ c: b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".", m: marks[off + i] })),
    });
  }
  return out;
}

const descFile = fileOf(DESC_RVA);
const headLines = hexdump(0, TEXT_DUMP_END);
const rdataLines = hexdump(descFile, RDATA_DUMP_END);

export const dumpLines: DumpLine[] = [
  { kind: "cmd", text: `hexdump -C specimen.exe | head -n ${headLines.length}` },
  ...headLines,
  {
    kind: "cmd",
    text: `hexdump -C -s 0x${hex(descFile, 0)} -n 0x${hex(RDATA_DUMP_END - descFile, 0)} specimen.exe`,
  },
  ...rdataLines,
  { kind: "end", off: hex(RDATA_DUMP_END, 8) },
];

export const flaggedImports = imports.flatMap((i) => i.fns.map((f) => f.name));

/** Raw image bytes (headers, .text stub, .rdata imports), e.g. for validating with real PE tools. */
export const peBytes = buf;
