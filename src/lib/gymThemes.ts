export const gymThemes = [
  { id: 'fuchsia-grey', name: 'Fuchsia & Grey', accent: '#D946A8', sidebar: '#303038', canvas: '#F7F5F8', swatch: 'linear-gradient(90deg, #D946A8 0 33%, #303038 33% 66%, #F7F5F8 66%)' },
  { id: 'cream-black', name: 'Cream & Black', accent: '#F3EBDD', sidebar: '#171717', canvas: '#FFFFFF', swatch: 'linear-gradient(90deg, #F3EBDD 0 33%, #171717 33% 66%, #FFFFFF 66%)' },
  { id: 'red-black', name: 'Red & Black', accent: '#D92D35', sidebar: '#171717', canvas: '#F5F5F5', swatch: 'linear-gradient(90deg, #D92D35 0 33%, #171717 33% 66%, #F5F5F5 66%)' },
  { id: 'green-ivory-yellow', name: 'Green, Ivory & Yellow', accent: '#EACB48', sidebar: '#173D32', canvas: '#F6F0E4', swatch: 'linear-gradient(90deg, #173D32 0 33%, #F6F0E4 33% 66%, #EACB48 66%)' },
  { id: 'beige-grey', name: 'Beige & Grey', accent: '#D9C6A5', sidebar: '#353535', canvas: '#FAF8F3', swatch: 'linear-gradient(90deg, #D9C6A5 0 33%, #353535 33% 66%, #FAF8F3 66%)' },
  { id: 'navy-electric', name: 'Navy & Electric Blue', accent: '#247BFF', sidebar: '#101D3A', canvas: '#F5F8FF', swatch: 'linear-gradient(90deg, #101D3A 0 33%, #247BFF 33% 66%, #F5F8FF 66%)' },
  { id: 'gradient-blue', name: 'Gradient Blue', accent: '#247BFF', accentSwatch: 'linear-gradient(90deg, #7157F5 0%, #247BFF 100%)', sidebar: '#10264B', canvas: '#FFFFFF', swatch: 'linear-gradient(90deg, #7157F5 0%, #247BFF 100%)' },
  { id: 'brown-beige', name: 'Brown & Beige', accent: '#70452F', sidebar: '#DCC6A5', canvas: '#FAF5ED', swatch: 'linear-gradient(90deg, #70452F 0 33%, #DCC6A5 33% 66%, #FAF5ED 66%)' },
  { id: 'onyx-champagne', name: 'Onyx & Champagne', accent: '#C5F36B', sidebar: '#151817', canvas: '#F4F1E9', swatch: 'linear-gradient(90deg, #151817 0 33%, #C5F36B 33% 66%, #F4F1E9 66%)' },
] as const

export type GymThemeId = typeof gymThemes[number]['id']
export const DEFAULT_GYM_THEME: GymThemeId = 'onyx-champagne'
export function normalizeGymTheme(value: unknown): GymThemeId {
  return gymThemes.some(theme => theme.id === value) ? value as GymThemeId : DEFAULT_GYM_THEME
}
