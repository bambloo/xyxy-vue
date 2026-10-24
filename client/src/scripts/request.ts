import axios, { AxiosError, AxiosHeaders } from 'axios'
import type { Ref } from 'vue'
import { BamblooStatusCode } from '../../../common/status'
import type { ResponsePacket } from '../../../common/status'

const AUTH_STORAGE_KEY = 'bambloo-auth'
type PostData = Uint8Array | { [key: string]: unknown }

// type ResponseCallback = (packet: ResponsePacket) => unknown

// let global_error_callback: ResponseCallback

// export function onError(callback: ResponseCallback) {
//   global_error_callback = callback
// }

export function post<Raw extends boolean = false>(
  url: string,
  loading: Ref<boolean>,
  data?: PostData,
  headers?: AxiosHeaders,
  raw?: Raw,
): Promise<Raw extends true ? Blob : ResponsePacket> {
  loading.value = true
  const token = localStorage.getItem(AUTH_STORAGE_KEY)
  return axios(url, {
    method: 'post',
    data: data,
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    withCredentials: true,
    responseType: raw ? 'blob' : 'json',
  })
    .then((response) => {
      loading.value = false
      if (raw) {
        // console.log(response.data)
        return response.data as Blob
      }
      const data = response.data as ResponsePacket
      if (data.code == BamblooStatusCode.Success) {
        return data
      } else {
        throw data
      }
    })
    .catch((err) => {
      loading.value = false
      console.log(err)
      if (err instanceof AxiosError) {
        throw { code: BamblooStatusCode.NetworkInvalid, msg: err.message }
      } else {
        throw err
      }
    }) as Promise<Raw extends true ? Blob : ResponsePacket>
}
