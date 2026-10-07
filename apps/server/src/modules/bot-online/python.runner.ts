import { DEFAULT_BOT_LIMITS, type BotInvocationRequest } from "@ottv2/bot-sdk";

/** Trusted wrapper, interpreted only inside pinned CPython-WASI. */
export function buildPythonRunner(request: BotInvocationRequest): string {
  const payload = JSON.stringify(JSON.stringify({ ...request, state: { ...request.state, legal_moves: request.state.legalMoves, turn_number: request.state.turnNumber, clocks_ms: request.state.clocksMs } }));
  const budget = request.phase === "PREFLIGHT" ? DEFAULT_BOT_LIMITS.preflightMs : DEFAULT_BOT_LIMITS.perTurnMs;
  return `
import ast as _ast, builtins as _builtins, json as _json, types as _types, sys as _sys, time as _time
_request = _json.loads(${payload})
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
 'abs','all','any','bool','dict','enumerate','filter','float','frozenset','int','hash',
 'isinstance','issubclass','iter','len','list','map','max','min','next','pow','range',
 'repr','reversed','round','set','slice','sorted','str','sum','tuple','zip',
 'Exception','ValueError','TypeError','RuntimeError')}
_safe_builtins['__import__'] = _safe_import
_forbidden = {'eval','exec','compile','open','input','globals','locals','vars','getattr','setattr','delattr','type','super','help','breakpoint'}
# Marker distinguishes a guest error from failure during trusted bootstrap.
print('__OTT_STARTED__', flush=True)
_started = _time.monotonic()
_deadline = _started + ${budget} / 1000
def _trace(frame, event, arg):
    if _time.monotonic() > _deadline:
        raise RuntimeError('BOT_COMPUTE_BUDGET')
    return _trace
_sys.settrace(_trace)
try:
    _tree = _ast.parse(_request['source'])
    for _node in _ast.walk(_tree):
        if isinstance(_node, _ast.Attribute) and (_node.attr.startswith('_') or _node.attr in _forbidden or _node.attr in ('sys','os','modules')):
            raise ValueError('FORBIDDEN_API')
        if isinstance(_node, _ast.Name) and (_node.id.startswith('__') or _node.id in _forbidden):
            raise ValueError('FORBIDDEN_API')
        if isinstance(_node, (_ast.Import, _ast.ImportFrom)):
            _names = [alias.name for alias in _node.names] if isinstance(_node, _ast.Import) else [_node.module or '']
            if any(name.split('.')[0] not in _modules for name in _names):
                raise ValueError('IMPORT_NOT_ALLOWED')
    _namespace = {'__builtins__': _safe_builtins, '__name__': '__bot__', 'seed': _request['seed']}
    exec(compile(_tree, '<bot>', 'exec'), _namespace, _namespace)
    _result = _namespace['choose_move'](_request['state'], _request['memory'])
    if _time.monotonic() > _deadline:
        raise RuntimeError('BOT_COMPUTE_BUDGET')
finally:
    _sys.settrace(None)
if isinstance(_result, tuple) and len(_result) == 2:
    _result = {'move': _result[0], 'memory': _result[1]}
_text = _json.dumps(_result, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
if len(_text.encode('utf-8')) > ${DEFAULT_BOT_LIMITS.outputBytes}:
    raise ValueError('OUTPUT_BUDGET')
print(_text)
`;
}
