// Tarjan's algorithm returns dependencies before their consumers, including
// singleton groups. Members of a cycle must be versioned together.
export function dependencyGroups<T>(graph: ReadonlyMap<T, ReadonlySet<T>>): T[][] {
  const indices = new Map<T, number>();
  const lowlinks = new Map<T, number>();
  const stack: T[] = [];
  const stacked = new Set<T>();
  const groups: T[][] = [];

  function visit(current: T) {
    const index = indices.size;

    indices.set(current, index);
    lowlinks.set(current, index);
    stack.push(current);
    stacked.add(current);

    for (const dependency of graph.get(current) ?? []) {
      if (!indices.has(dependency)) {
        visit(dependency);
        lowlinks.set(
          current,
          Math.min(lowlinks.get(current) ?? index, lowlinks.get(dependency) ?? index),
        );
      } else if (stacked.has(dependency)) {
        lowlinks.set(
          current,
          Math.min(lowlinks.get(current) ?? index, indices.get(dependency) ?? index),
        );
      }
    }

    if (lowlinks.get(current) !== index) return;

    const group: T[] = [];
    let member: T | undefined;

    do {
      member = stack.pop();
      if (member === undefined) throw new Error('Invalid dependency graph');

      stacked.delete(member);
      group.push(member);
    } while (member !== current);

    groups.push(group);
  }

  for (const node of graph.keys()) {
    if (!indices.has(node)) visit(node);
  }

  return groups;
}
