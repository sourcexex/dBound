#!/usr/bin/env node
/**
 * Single source of truth for the app version.
 *
 * The semver value lives in src-tauri/tauri.conf.json; package.json, Cargo.toml
 * and resources/版本信息.txt must always match. `check` is wired into the build
 * so a drifted checkout cannot produce an installer.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const paths = {
  tauri: resolve(root, 'src-tauri/tauri.conf.json'),
  pkg: resolve(root, 'package.json'),
  cargo: resolve(root, 'src-tauri/Cargo.toml'),
  info: resolve(root, 'resources/版本信息.txt'),
}
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

const read = (path) => readFileSync(path, 'utf8')
const tauriVersion = (text) => JSON.parse(text).version
const pkgVersion = (text) => JSON.parse(text).version
const cargoVersion = (text) => text.match(/^version\s*=\s*"([^"]+)"/m)?.[1]
const infoVersion = (text) => text.match(/^版本：v?([0-9]+\.[0-9]+\.[0-9]+)\s*$/m)?.[1]

function fail(lines) {
  for (const line of lines) console.error(`FAIL ${line}`)
  process.exit(1)
}

function check() {
  const tauri = tauriVersion(read(paths.tauri))
  const failures = []
  if (!SEMVER.test(tauri)) failures.push(`src-tauri/tauri.conf.json: "${tauri}" is not plain semver (x.y.z)`)
  const pkg = pkgVersion(read(paths.pkg))
  if (pkg !== tauri) failures.push(`package.json: ${pkg} != ${tauri}`)
  const cargo = cargoVersion(read(paths.cargo))
  if (cargo !== tauri) failures.push(`src-tauri/Cargo.toml: ${cargo} != ${tauri}`)
  const info = infoVersion(read(paths.info))
  if (info !== tauri) failures.push(`resources/版本信息.txt: ${info} != ${tauri}`)
  for (const [file, text] of [
    ['src-tauri/tauri.conf.json', read(paths.tauri)],
    ['package.json', read(paths.pkg)],
    ['src-tauri/Cargo.toml', read(paths.cargo)],
  ]) {
    if (/\bBeta\d*\b/i.test(text)) failures.push(`${file}: channel marker (Beta) must not be part of the version`)
  }
  if (failures.length > 0) fail(failures)
  console.log(`PASS version ${tauri}`)
}

function setVersion(next) {
  if (!SEMVER.test(next)) fail([`"${next}" is not plain semver (x.y.z)`])
  const tauriText = read(paths.tauri).replace(/("version"\s*:\s*")[^"]+"/, `$1${next}"`)
  writeFileSync(paths.tauri, tauriText)
  const pkgText = read(paths.pkg).replace(/("version"\s*:\s*")[^"]+"/, `$1${next}"`)
  writeFileSync(paths.pkg, pkgText)
  const cargoText = read(paths.cargo).replace(/^version\s*=\s*"[^"]+"/m, `version = "${next}"`)
  writeFileSync(paths.cargo, cargoText)
  const infoText = read(paths.info).replace(/^版本：v?[0-9]+\.[0-9]+\.[0-9]+\s*$/m, `版本：v${next}`)
  writeFileSync(paths.info, infoText)
  console.log(`PASS version set to ${next}`)
}

const [command, value] = process.argv.slice(2)
if (command === 'check') check()
else if (command === 'set' && value) setVersion(value)
else {
  console.error('usage: node scripts/version.mjs <check|set <x.y.z>>')
  process.exit(2)
}
