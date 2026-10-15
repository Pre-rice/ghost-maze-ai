import importlib.util
import unittest
from pathlib import Path

script=Path(__file__).parents[2]/'scripts/train-ghost-residual.py'
spec=importlib.util.spec_from_file_location('residual_metrics',script)
metrics=importlib.util.module_from_spec(spec)
spec.loader.exec_module(metrics)


def fixture():
    return [
        dict(h=2,noGhostBound=2,noGhostUnreachable=False,overlap=False,won=False,distance=2,edges=[dict(to=1,action='U',row=0),dict(to=2,action='R',row=1)]),
        dict(h=0,noGhostBound=None,noGhostUnreachable=True,overlap=False,won=False,distance=None,edges=[]),
        dict(h=3,noGhostBound=1,noGhostUnreachable=False,overlap=False,won=False,distance=1,edges=[dict(to=3,action='R',row=2)]),
        dict(h=0,noGhostBound=0,noGhostUnreachable=False,overlap=False,won=True,distance=0,edges=[]),
    ]


class PlanningMetricsTest(unittest.TestCase):
    def test_manual_comparators_use_declared_heuristic(self):
        nodes=fixture()
        geometric=metrics.rollout(nodes,relaxed=False)
        relaxed=metrics.rollout(nodes,relaxed=True)
        self.assertEqual(geometric['actions'],['U'])
        self.assertFalse(geometric['won'])
        self.assertEqual(relaxed['actions'],['R','R'])
        self.assertTrue(relaxed['won'])

    def test_exact_labels_do_not_select_actions_or_claim_proof(self):
        a=fixture()
        expected=metrics.run_search(a)
        for node in a:
            node['distance']=999
        changed=metrics.run_search(a)
        self.assertEqual(expected['actions'],changed['actions'])
        self.assertEqual(changed['optimality'],'not_proven_by_this_search')
        self.assertFalse(changed['matchesKnownOptimum'])


if __name__=='__main__':
    unittest.main()
