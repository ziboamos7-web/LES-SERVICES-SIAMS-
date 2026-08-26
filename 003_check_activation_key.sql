-- Pré-validation d'un code partenaire avant création du compte.
-- Le code n'est PAS consommé par cette fonction.

create or replace function public.check_activation_key(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_key activation_keys%rowtype;
begin
    select *
    into v_key
    from activation_keys
    where upper(trim(code)) = upper(trim(p_code))
    limit 1;

    if not found then
        return json_build_object(
            'success', false,
            'error', 'invalid_code'
        );
    end if;

    if v_key.used then
        return json_build_object(
            'success', false,
            'error', 'code_already_used'
        );
    end if;

    return json_build_object(
        'success', true,
        'plan', v_key.plan,
        'duration_days', v_key.duration_days
    );
end;
$function$;
