"""
Custom Loss Functions for Agricultural Perception Training
Implements:
1. AsymmetricFocalLoss (Penalizes false alarms on hard negatives with gamma_neg = 4.0)
2. EnergyRegularizedLoss (Shapes OOD margin in feature space)
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

class AsymmetricFocalLoss(nn.Module):
    """
    Asymmetric Focal Loss for binary/multi-label classification.
    Dramatically increases the focusing penalty (gamma_neg = 4.0) on false positives
    to prevent background noise (soil, hands, tools) from being misclassified as plants.
    """
    def __init__(self, gamma_pos: float = 1.5, gamma_neg: float = 4.0, alpha: float = 0.65, eps: float = 1e-8):
        super().__init__()
        self.gamma_pos = gamma_pos
        self.gamma_neg = gamma_neg
        self.alpha = alpha
        self.eps = eps

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        probs = torch.sigmoid(logits)
        
        # Positive loss term (Target Plant/Organ)
        pos_loss = -self.alpha * ((1.0 - probs) ** self.gamma_pos) * torch.log(probs.clamp(min=self.eps)) * targets
        
        # Negative loss term (Hard Negative / Background) with heavy gamma_neg penalty
        neg_loss = -(1.0 - self.alpha) * (probs ** self.gamma_neg) * torch.log((1.0 - probs).clamp(min=self.eps)) * (1.0 - targets)
        
        return (pos_loss + neg_loss).mean()

class EnergyRegularizedLoss(nn.Module):
    """
    Energy Regularized Cross-Entropy Loss.
    Encourages in-distribution plant samples to have low free energy E(x; T) < -6.0
    and out-of-distribution negative samples to have high energy E(x; T) > -2.0.
    """
    def __init__(self, temperature: float = 1.35, margin_in: float = -6.0, margin_out: float = -2.0, lambda_energy: float = 0.1):
        super().__init__()
        self.t = temperature
        self.m_in = margin_in
        self.m_out = margin_out
        self.lambda_energy = lambda_energy
        self.ce = nn.CrossEntropyLoss()

    def forward(self, logits_in: torch.Tensor, targets_in: torch.Tensor, logits_ood: torch.Tensor = None) -> torch.Tensor:
        loss_ce = self.ce(logits_in, targets_in)
        
        # In-distribution energy: E(x) = -T * logsumexp(z_i / T)
        energy_in = -self.t * torch.logsumexp(logits_in / self.t, dim=-1)
        loss_energy_in = torch.mean(F.relu(energy_in - self.m_in) ** 2)
        
        total_loss = loss_ce + self.lambda_energy * loss_energy_in
        
        if logits_ood is not None:
            energy_ood = -self.t * torch.logsumexp(logits_ood / self.t, dim=-1)
            loss_energy_ood = torch.mean(F.relu(self.m_out - energy_ood) ** 2)
            total_loss += self.lambda_energy * loss_energy_ood
            
        return total_loss
