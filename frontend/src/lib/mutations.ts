import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/Toast'

/**
 * Mutação padrão do CRM: ao concluir invalida as consultas informadas (prefixos de chave), avisa o usuário
 * e chama `onDone`. Em erro, a mensagem fica em `mutation.error` para o formulário exibir.
 */
export function useCrmMutation<TVars, TData>(
  mutationFn: (vars: TVars) => Promise<TData>,
  invalidate: string[],
  message?: string | ((data: TData) => string),
  onDone?: (data: TData) => void,
) {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn,
    onSuccess: async (data) => {
      await Promise.all(invalidate.map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
      if (message) toast(typeof message === 'function' ? message(data) : message)
      onDone?.(data)
    },
    onError: async () => {
      // Em conflito (409) ou erro de regra, recarrega para o usuário ver o estado atual.
      await Promise.all(invalidate.map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
    },
  })
}
