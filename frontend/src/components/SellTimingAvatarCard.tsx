import { Card, CardContent, Typography, Box, useTheme } from '@mui/material'
import UridokiKunAvatar from './UridokiKunAvatar'
import { MA_PERSONA } from '../constants/maPersona'
import { type Decision } from '../domain/decision'
import { type ScoreMaDays } from '../constants/maAvatarMap'

export type SellTimingAvatarCardProps = {
  decision: Decision
  scoreMaDays: ScoreMaDays
}

export default function SellTimingAvatarCard({ decision, scoreMaDays }: SellTimingAvatarCardProps) {
  const theme = useTheme()
  const maPersona = MA_PERSONA[scoreMaDays]
  const badgeBg = theme.palette.mode === 'dark' ? 'rgba(32, 36, 44, 0.8)' : 'rgba(255, 255, 255, 0.9)'
  const badgeBorder = theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.12)'

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
          <Box textAlign="center" sx={{ width: '100%' }}>
            <Box
              position="relative"
              display="inline-flex"
              sx={{
                overflow: 'visible',
                width: 420,
                height: 420,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UridokiKunAvatar decision={decision} size={360} animated />
              <Box
                sx={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  bgcolor: badgeBg,
                  border: `1px solid ${badgeBorder}`,
                  borderRadius: 2,
                  px: 1,
                  py: 0.5,
                  boxShadow:
                    theme.palette.mode === 'dark'
                      ? '0 8px 18px rgba(0,0,0,0.35)'
                      : '0 8px 18px rgba(0,0,0,0.12)',
                }}
              >
                <Typography variant="body2" component="span" sx={{ display: 'inline-flex', gap: 0.25 }}>
                  <span aria-hidden>{maPersona.icon}</span>
                  <Box component="span" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                    {maPersona.label}
                  </Box>
                </Typography>
              </Box>
            </Box>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ mt: 1, textAlign: 'center', whiteSpace: 'normal', wordBreak: 'break-word' }}
            >
              売り時くん
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.5, textAlign: 'center', whiteSpace: 'normal', wordBreak: 'break-word' }}
            >
              スコアに応じて表示が変わります
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}
