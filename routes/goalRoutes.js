const express = require('express');
const router = express.Router();
const {
  createGoal,
  getGoals,
  updateGoal,
  deleteGoal,
  canIAfford
} = require('../controllers/goalController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createGoal);
router.get('/', protect, getGoals);
router.put('/:id', protect, updateGoal);
router.delete('/:id', protect, deleteGoal);
router.post('/afford', protect, canIAfford);

module.exports = router;