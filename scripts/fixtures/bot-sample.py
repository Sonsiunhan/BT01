def choose_move(state, memory):
    seen = int(memory.get("seen", 0)) if isinstance(memory, dict) else 0
    return state["legal_moves"][0], {"seen": seen + 1}
