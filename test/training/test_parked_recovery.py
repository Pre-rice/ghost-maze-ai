"""验证闭环选择不把诊断未来或身份当作输入，以及可行绕路不会被直接删除。"""
import importlib.util
import unittest
from collections import Counter
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/train-parked-recovery.py'
spec = importlib.util.spec_from_file_location('recovery', SCRIPT)
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)


class Forbidden(dict):
    def __getitem__(self, key):
        if key in ['distance', 'anchorOccupied', 'originalAtAnchor', 'kind', 'preferred']:
            raise AssertionError('选择器读取了未来答案或身份：' + key)
        return super().__getitem__(key)


class RecoverySelectionTest(unittest.TestCase):
    def test_choice_without_future_or_identity_and_invariant_to_poison_values(self):
        nodes = [Forbidden(group=i, goal=False, h=i) for i in range(3)]
        candidates = [dict(to=1, row=0), dict(to=2, row=1)]
        for mode, expected in [('recovery', 1), ('value', 2), ('combined', 1)]:
            self.assertEqual(recovery.choose(candidates, nodes, Counter(), mode, [0.9, 0.1], [20, 1])['to'], expected)

    def test_uncertain_recovery_does_not_remove_all_actions(self):
        nodes = [Forbidden(group=i, goal=False, h=i) for i in range(3)]
        edge = recovery.choose([dict(to=1, row=0), dict(to=2, row=1)], nodes, Counter(), 'combined', [0.1, 0.2], [9, 4])
        self.assertEqual(edge['to'], 2)

    def test_requested_goal_and_shared_revisit_controller(self):
        nodes = [Forbidden(group=i, goal=False, h=0) for i in range(3)]
        candidates = [dict(to=1, row=0), dict(to=2, row=1)]
        self.assertEqual(recovery.choose(candidates, nodes, Counter({1: 1}), 'value', [1, 1], [0, 99])['to'], 2)
        nodes[1]['goal'] = True
        self.assertEqual(recovery.choose(candidates, nodes, Counter({1: 1}), 'value', [1, 1], [0, 99])['to'], 1)

    def test_goal_on_last_allowed_action_is_success(self):
        nodes = [dict(group=0, goal=False, edges=[dict(to=1, row=0, action='R')]),
                 dict(group=1, goal=True, overlap=False, originalGameWon=False,
                      anchorOccupied=True, originalAtAnchor=True, edges=[])]
        result = recovery.rollout(dict(shortest=1), dict(nodes=nodes), 'value', [1], [0], step_budget=1)
        self.assertTrue(result['goalReached'])
        self.assertTrue(result['optimalToGoal'])
        self.assertEqual(result['stopReason'], 'given_goal')


if __name__ == '__main__':
    unittest.main()
