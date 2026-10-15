"""有界展开必须区分未知和无解，并遵守统一预算、避免未来答案泄漏。"""
import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/evaluate-parked-lookahead.py'
spec = importlib.util.spec_from_file_location('lookahead', SCRIPT)
lookahead = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lookahead)


class PublicNode(dict):
    def __getitem__(self, key):
        if key in ['distance', 'kind', 'anchorOccupied', 'originalAtAnchor', 'witness']:
            raise AssertionError('规划读取了未来或身份：' + key)
        return super().__getitem__(key)


def node(group, edges, goal=False):
    return dict(group=group, edges=edges, goal=goal, overlap=False, originalGameWon=False,
                anchorOccupied=True, originalAtAnchor=True, h=0)


class LookaheadTest(unittest.TestCase):
    def test_budget_unknown_and_exhausted_cycle_are_different(self):
        nodes = [PublicNode(node(0, [dict(to=1)])), PublicNode(node(1, [dict(to=0)]))]
        self.assertEqual(lookahead.probe(nodes, 0, 1), ('unknown', 1))
        self.assertEqual(lookahead.probe(nodes, 0, 2), ('unsolvable', 2))

    def test_given_goal_requires_no_extra_expansion(self):
        self.assertEqual(lookahead.probe([PublicNode(node(0, [], True))], 0, 0), ('reachable', 0))

    def test_sound_filter_and_global_budget(self):
        nodes = [node(0, [dict(to=1, row=0, action='R'), dict(to=2, row=1, action='L')]),
                 node(1, []), node(2, [dict(to=3, row=2, action='R')]), node(3, [], True)]
        task, graph, scores = dict(shortest=2), dict(nodes=nodes), [1, 0, 0]
        original = lookahead.rollout(task, graph, None, 'learned', scores, 0)
        self.assertFalse(original['goalReached'])
        filtered = lookahead.rollout(task, graph, None, 'learned', scores, 8, total_budget=1)
        self.assertTrue(filtered['goalReached'])
        self.assertEqual(filtered['expanded'], 1)
        self.assertGreater(filtered['unknownActionsRetained'], 0)
        unchanged = lookahead.rollout(task, graph, None, 'learned', scores, 8, total_budget=0)
        self.assertEqual(unchanged['actions'], original['actions'])
        self.assertEqual(unchanged['expanded'], 0)


if __name__ == '__main__':
    unittest.main()
