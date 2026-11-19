export type Pendiente = {
  cuenta: string; cuentaId: string; envioId: string; ordenes: string[];
  tipo: 'flex' | 'colecta' | 'correo'; tipoTexto: string;
  comprador: string; receptor: string; zona: string;
  items: { titulo: string; cant: number; itemId: string }[];
  creado: string; despacho: string; estado: 'ATRASADO' | 'HOY' | 'PROXIMO'; subestado: string; link: string;
};
export type Pregunta = {
  cuenta: string; cuentaId: string; id: string; itemId: string; producto: string;
  texto: string; creado: string; minutos: number; link: string;
};
export type Reclamo = {
  cuenta: string; cuentaId: string; id: string; orden: string; tipo: string; motivo: string; creado: string; link: string;
};
export type Operacion = { pendientes: Pendiente[]; preguntas: Pregunta[]; reclamos: Reclamo[]; actualizado: string; error?: string };
export type Reputacion = {
  nivel: string; color: string; medalla: string;
  reclamos: number | null; demoras: number | null; cancelaciones: number | null; ventas60: number | null;
};
