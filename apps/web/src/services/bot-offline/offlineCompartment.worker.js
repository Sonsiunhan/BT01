/* Trusted bootstrap. Executed only inside an opaque-origin sandboxed frame. */
/* global self, importScripts, _createPyodideModule, URL, Blob, WebAssembly, Response, TextEncoder, performance */
let engine;
let limits;
const send = self.postMessage.bind(self);
const deny = () => { throw new Error("CAPABILITY_DENIED"); };

async function boot(assets, preset, seed) {
  limits = preset;
  const urls = [];
  const blobUrl = (bytes, type) => {
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    urls.push(url);
    return url;
  };
  const moduleUrl = blobUrl(assets["pyodide.mjs"], "text/javascript");
  importScripts(blobUrl(assets["pyodide.asm.js"], "text/javascript"));
  // Pyodide 0.27.3 does not forward its public wasmMemory option to the
  // Emscripten settings. Inject the real bounded memory at this pinned seam.
  const factory = _createPyodideModule;
  const memory = new WebAssembly.Memory({ initial: 320, maximum: limits.wasmMemoryPages });
  self._createPyodideModule = (settings) => factory({ ...settings, wasmMemory: memory });
  const origin = "https://ott-runtime.invalid/";
  // No actual fetch: only verified, already-transferred public runtime bytes.
  self.fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input.href ?? input.url);
    const name = url.pathname.slice(1);
    if (url.origin !== new URL(origin).origin || !Object.hasOwn(assets, name)) throw new Error("CAPABILITY_DENIED");
    return new Response(assets[name], { headers: { "Content-Type": name.endsWith(".wasm") ? "application/wasm" : "application/octet-stream" } });
  };
  const { loadPyodide } = await import(moduleUrl);
  let outputBytes = 0;
  const output = (line) => {
    outputBytes += new TextEncoder().encode(line).byteLength;
    if (outputBytes > limits.privateLogBytes) throw new Error("OUTPUT_BUDGET");
  };
  engine = await loadPyodide({ indexURL: origin, jsglobals: Object.freeze({}), packages: [], env: { PYTHONHASHSEED: String(seed) }, stdout: output, stderr: output });
  if (engine.version !== "0.27.3") throw new Error("RUNTIME_VERSION_MISMATCH");
  if (engine._module.HEAP8.buffer !== memory.buffer) throw new Error("RUNTIME_MEMORY_UNBOUNDED");
  let memoryMaximumEnforced = false;
  try { memory.grow(limits.wasmMemoryPages + 1); } catch { memoryMaximumEnforced = true; }
  if (!memoryMaximumEnforced) throw new Error("RUNTIME_MEMORY_UNBOUNDED");
  for (const capability of ["fetch", "XMLHttpRequest", "WebSocket", "indexedDB", "caches", "cookieStore", "Worker", "SharedWorker", "importScripts"]) {
    Object.defineProperty(self, capability, { value: capability === "fetch" ? deny : undefined, configurable: false, writable: false });
  }
  for (const url of urls) URL.revokeObjectURL(url);
  // Trusted imports occur before the bot. Bot AST and builtins expose only the
  // approved SDK subset, never the host interpreter namespace or JS bridge.
  engine.runPython(`
import ast as _ast, builtins as _builtins, json as _json, types as _types
_allowed = ('collections','functools','heapq','itertools','json','math','statistics','typing')
# Never expose a whole trusted stdlib module: typing.get_type_hints and similar
# introspection helpers can evaluate strings outside the submitted AST.
_exports = {
 'collections': ('Counter','defaultdict','deque','OrderedDict','namedtuple'),
 'functools': ('reduce','partial','lru_cache','cache','cmp_to_key'),
 'heapq': ('heapify','heappush','heappop','heappushpop','heapreplace','nlargest','nsmallest','merge'),
 'itertools': ('count','cycle','repeat','accumulate','chain','compress','dropwhile','filterfalse','islice','pairwise','starmap','takewhile','tee','zip_longest','product','permutations','combinations','combinations_with_replacement','groupby'),
 'json': ('loads','dumps'),
 'math': ('pi','e','tau','inf','nan','ceil','floor','trunc','fabs','factorial','gcd','lcm','isclose','isfinite','isinf','isnan','exp','log','log2','log10','pow','sqrt','sin','cos','tan','asin','acos','atan','atan2','hypot','degrees','radians','fsum','prod','comb','perm'),
 'statistics': ('mean','fmean','median','median_low','median_high','mode','multimode','pstdev','pvariance','stdev','variance','quantiles'),
 'typing': ('Any','List','Tuple','Dict','Set','FrozenSet','Optional','Union','Iterable','Iterator','Sequence','Mapping')
}
_modules = {name: _types.SimpleNamespace(**{key: getattr(_builtins.__import__(name), key) for key in keys}) for name, keys in _exports.items()}
def _safe_import(name, globals=None, locals=None, fromlist=(), level=0):
    if level or name.split('.')[0] not in _modules:
        raise ImportError('IMPORT_NOT_ALLOWED')
    return _modules[name.split('.')[0]]
_safe_builtins = {key: getattr(_builtins, key) for key in (
 'abs','all','any','bool','dict','enumerate','filter','float','frozenset','int',
 'hash','isinstance','issubclass','iter','len','list','map','max','min','next','pow',
 'range','repr','reversed','round','set','slice','sorted','str','sum','tuple',
 'zip','Exception','ValueError','TypeError','RuntimeError')}
_safe_builtins['__import__'] = _safe_import
_forbidden = {'eval','exec','compile','open','input','globals','locals','vars','getattr','setattr','delattr','type','super','help','breakpoint'}
def _run_bot(payload):
    request = _json.loads(payload)
    tree = _ast.parse(request['source'])
    for node in _ast.walk(tree):
        if isinstance(node, _ast.Attribute) and (node.attr.startswith('_') or node.attr in _forbidden or node.attr in ('sys','os','modules')):
            raise ValueError('FORBIDDEN_API')
        if isinstance(node, _ast.Name) and (node.id.startswith('__') or node.id in _forbidden):
            raise ValueError('FORBIDDEN_API')
        if isinstance(node, (_ast.Import, _ast.ImportFrom)):
            names = [alias.name for alias in node.names] if isinstance(node, _ast.Import) else [node.module or '']
            if any(name.split('.')[0] not in _allowed for name in names):
                raise ValueError('IMPORT_NOT_ALLOWED')
    namespace = {'__builtins__': _safe_builtins, '__name__': '__bot__'}
    exec(compile(tree, '<bot>', 'exec'), namespace, namespace)
    state = request['state']
    state['legal_moves'] = state['legalMoves']
    state['turn_number'] = state['turnNumber']
    state['clocks_ms'] = state['clocksMs']
    move, memory = namespace['choose_move'](state, request['memory'])
    text = _json.dumps({'move': move, 'memory': memory}, separators=(',', ':'), allow_nan=False)
    if len(text.encode('utf-8')) > ${limits.outputBytes}:
        raise ValueError('OUTPUT_BUDGET')
    return text
`);
  let networkDenied = false;
  try { await self.fetch("https://example.invalid/private"); } catch { networkDenied = true; }
  send({ kind: "booted", proof: { memoryBytes: memory.buffer.byteLength, memoryMaximumPages: limits.wasmMemoryPages, memoryMaximumEnforced, networkDenied, storageAbsent: self.indexedDB === undefined && self.caches === undefined } });
}

self.onmessage = async (event) => {
  try {
    if (event.data.kind === "boot") { await boot(event.data.assets, event.data.limits, event.data.seed); return; }
    if (event.data.kind !== "run" || !engine) throw new Error("PROTOCOL_ERROR");
    const started = performance.now();
    send({ kind: "compute-started" });
    const result = engine.runPython(`_run_bot(${JSON.stringify(event.data.payload)})`);
    send({ kind: "result", ok: true, text: String(result), computeMs: performance.now() - started });
  } catch (error) {
    // Only bounded error categories, never private traceback/source to the UI.
    const text = String(error);
    const code = ["OUTPUT_BUDGET", "IMPORT_NOT_ALLOWED", "FORBIDDEN_API", "RUNTIME_VERSION_MISMATCH"].find((key) => text.includes(key));
    send({ kind: "result", ok: false, code: code ?? (engine ? "BOT_RUNTIME_FAILED" : "BOT_WORKER_FAILED") });
  }
};
