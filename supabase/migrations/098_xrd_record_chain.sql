alter table public.xrc_records
  drop constraint if exists xrc_records_stream_type_check;

alter table public.xrc_records
  add constraint xrc_records_stream_type_check
  check (stream_type in ('XTRC', 'XERC', 'XARC', 'XCRC', 'XPRC', 'XSRC', 'XWRC', 'XDRC'));

alter table public.xrc_root_chain
  drop constraint if exists xrc_root_chain_stream_type_check;

alter table public.xrc_root_chain
  add constraint xrc_root_chain_stream_type_check
  check (stream_type in ('XTRC', 'XERC', 'XARC', 'XCRC', 'XPRC', 'XSRC', 'XWRC', 'XDRC'));
