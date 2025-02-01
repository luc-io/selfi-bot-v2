import { Router } from 'express';
import { ParametersService } from '../../services/parameters.js';

const router = Router();

router.post('/params', async (req, res) => {
  try {
    const params = req.body;
    await ParametersService.updateUserParameters(params);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving parameters:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/params/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const params = await ParametersService.getUserParameters(userId);
    res.json(params);
  } catch (error) {
    console.error('Error getting parameters:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const paramsHandler = router;