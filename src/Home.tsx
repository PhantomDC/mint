import { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Snackbar } from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';

import * as anchor from '@project-serum/anchor';

import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { WalletDialogButton } from '@solana/wallet-adapter-material-ui';
import { GatewayProvider } from '@civic/solana-gateway-react';
import { MintButton } from './MintButton';

import {
	CandyMachine,
	awaitTransactionSignatureConfirmation,
	getCandyMachineState,
	mintOneToken,
	shortenAddress,
	CANDY_MACHINE_PROGRAM,
} from './candy-machine';

import { AlertState } from './utils';

const ConnectButton = styled(WalletDialogButton)``;

const MintContainer = styled.div``; // add your styles here

export interface HomeProps {
	candyMachineId: anchor.web3.PublicKey;
	connection: anchor.web3.Connection;
	txTimeout: number;
	rpcHost: string;
}

const getAvailableMints = async (walletId: string, token: string) => {
	const mintResponse = await fetch(`${process.env.REACT_APP_BACKEND_HOST}/api/mint/get?walletId=${walletId}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
		},
	});

	if (mintResponse.ok) {
		const mints = await mintResponse.json();
		return mints.count;
	}

	return 0;
};

const Home = (props: HomeProps) => {
	const [balance, setBalance] = useState<number>();
	const [isMinting, setIsMinting] = useState(false); // true when user got to press MINT
	const [isActive, setIsActive] = useState(false); // true when countdown completes
	const [mintCount, setMintCount] = useState<number | null>(0);
	const [token, setToken] = useState(null);
	const isFirstRender = useRef(true);

	const [itemsAvailable, setItemsAvailable] = useState(0);
	const [itemsRedeemed, setItemsRedeemed] = useState(0);
	const [itemsRemaining, setItemsRemaining] = useState(0);

	const [backendItemsAvailable, setBackednItemsAvailable] = useState(null);
	const [wlHas, setWlHas] = useState(false);

	const [alertState, setAlertState] = useState<AlertState>({
		open: false,
		message: '',
		severity: undefined,
	});

	const wallet = useAnchorWallet();
	const [candyMachine, setCandyMachine] = useState<CandyMachine>();

	const availableMints =
		itemsAvailable && backendItemsAvailable
			? backendItemsAvailable - itemsAvailable <= 0
				? backendItemsAvailable
				: itemsAvailable
			: 0;

	const rpcUrl = props.rpcHost;

	const refreshCandyMachineState = () => {
		(async () => {
			console.log('refresh cm');
			if (!wallet) return;

			const walletId = wallet.publicKey.toBase58() || '';

			try {
				const cndy = await getCandyMachineState(wallet as anchor.Wallet, props.candyMachineId, props.connection);
				if (!token && isFirstRender.current) {
					isFirstRender.current = false;
					const responseToken = await fetch(`${process.env.REACT_APP_BACKEND_HOST}/api/auth/verify`, {
						body: JSON.stringify({ walletId }),
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
					});

					if (responseToken.ok) {
						const data = await responseToken.json();
						setToken(data.token);

						const wlHas = await fetch(`${process.env.REACT_APP_BACKEND_HOST}/api/wl/has`, {
							body: JSON.stringify({ walletId }),
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
								Authorization: `Bearer ${data.token}`,
							},
						});

						setWlHas(wlHas.ok);

						if (wlHas.ok) {
							const count = await getAvailableMints(walletId, data.token);
							setBackednItemsAvailable(count);
						}
					}
				}

				setCandyMachine(cndy);

				setItemsAvailable(cndy.state.itemsAvailable);
				setItemsRemaining(cndy.state.itemsRemaining);
				setItemsRedeemed(cndy.state.itemsRedeemed);
				setIsActive(cndy.state.isActive);
			} catch (err) {
				console.error(err);
			}
		})();
	};

	const handleMint = async () => {
		let status: any = { err: true };
		if (wallet && candyMachine?.program && wallet.publicKey && token && wlHas) {
			const walletId = wallet.publicKey.toBase58() || '';
			const count = await getAvailableMints(walletId, token);
			if (count) {
				const mintTxId = (await mintOneToken(candyMachine, wallet.publicKey))[0];

				if (mintTxId) {
					status = await awaitTransactionSignatureConfirmation(
						mintTxId,
						props.txTimeout,
						props.connection,
						'singleGossip',
						true,
					);
				}
			}
		}

		return status;
	};

	const onMint = async () => {
		if (!wallet || !token) return;
		try {
			setIsMinting(true);
			document.getElementById('#identity')?.click();
			const walletId = wallet.publicKey.toBase58() || '';

			for (let i = 0; i < (mintCount || 1); i++) {
				console.log(`mint ${i + 1} token`);
				const status = await handleMint();
				if (!status?.err) {
					const addResponse = await fetch(`${process.env.REACT_APP_BACKEND_HOST}/api/mint/add`, {
						body: JSON.stringify({ walletId }),
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${token}`,
						},
					});

					if (addResponse.ok) {
						const data = await addResponse.json();
						setBackednItemsAvailable(data.count);
						setMintCount(data.count);

						setAlertState({
							open: true,
							message: 'Congratulations! Mint succeeded!',
							severity: 'success',
						});
					}
				} else {
					setAlertState({
						open: true,
						message: 'Mint failed! Please try again!',
						severity: 'error',
					});
				}
			}
		} catch (error: any) {
			// TODO: blech:
			let message = error.msg || 'Minting failed! Please try again!';
			if (!error.msg) {
				if (!error.message) {
					message = 'Transaction Timeout! Please try again.';
				} else if (error.message.indexOf('0x138')) {
				} else if (error.message.indexOf('0x137')) {
					message = `SOLD OUT!`;
				} else if (error.message.indexOf('0x135')) {
					message = `Insufficient funds to mint. Please fund your wallet.`;
				}
			} else {
				if (error.code === 311) {
					message = `SOLD OUT!`;
				} else if (error.code === 312) {
					message = `Minting period hasn't started yet.`;
				}
			}

			setAlertState({
				open: true,
				message,
				severity: 'error',
			});
		} finally {
			if (wallet) {
				const balance = await props.connection.getBalance(wallet.publicKey);
				setBalance(balance / LAMPORTS_PER_SOL);
			}
			setIsMinting(false);
			refreshCandyMachineState();
		}
	};

	useEffect(() => {
		(async () => {
			if (wallet) {
				const balance = await props.connection.getBalance(wallet.publicKey);
				setBalance(balance / LAMPORTS_PER_SOL);
			}
		})();
	}, [wallet, props.connection]);

	useEffect(refreshCandyMachineState, [wallet, props.candyMachineId, props.connection, token, isFirstRender]);

	const handleMintCounter = useCallback(
		(val: string) => {
			if (val !== '') {
				const counter = Number(val);
				if ((counter > 0 && counter <= availableMints) || val === '') {
					setMintCount(counter);
				} else if (counter > availableMints) {
					setMintCount(availableMints);
				} else if (counter < 1) {
					setMintCount(0);
				}
			} else {
				setMintCount(null);
			}
		},
		[availableMints],
	);

	if (token && !wlHas) {
		return <p>Not in white list</p>;
	}

	if (!token && !wlHas && !wallet) {
		return (
			<MintContainer>
				<ConnectButton>Connect Wallet</ConnectButton>
			</MintContainer>
		);
	}

	return (
		token &&
		wlHas && (
			<main>
				{wallet && <p>Wallet {shortenAddress(wallet.publicKey.toBase58() || '')}</p>}

				{wallet && <p>Balance: {(balance || 0).toLocaleString()} SOL</p>}

				{wallet && <p>Total Available: {availableMints}</p>}

				{wallet && <p>Redeemed: {itemsRedeemed}</p>}

				{wallet && <p>Remaining: {itemsRemaining}</p>}

				{
					<MintContainer>
						{wallet && isActive && candyMachine?.state.gatekeeper && wallet.publicKey && wallet.signTransaction ? (
							<GatewayProvider
								wallet={{
									publicKey: wallet.publicKey || new PublicKey(CANDY_MACHINE_PROGRAM),
									//@ts-ignore
									signTransaction: wallet.signTransaction,
								}}
								// // Replace with following when added
								// gatekeeperNetwork={candyMachine.state.gatekeeper_network}
								gatekeeperNetwork={candyMachine?.state?.gatekeeper?.gatekeeperNetwork} // This is the ignite (captcha) network
								/// Don't need this for mainnet
								clusterUrl={rpcUrl}
								options={{ autoShowModal: false }}
							>
								<MintButton
									availableMints={availableMints}
									candyMachine={candyMachine}
									isMinting={isMinting}
									onMint={onMint}
									mintCounter={mintCount}
									handleChangeMintCounter={handleMintCounter}
								/>
							</GatewayProvider>
						) : (
							<MintButton
								availableMints={availableMints}
								candyMachine={candyMachine}
								isMinting={isMinting}
								onMint={onMint}
								mintCounter={mintCount}
								handleChangeMintCounter={handleMintCounter}
							/>
						)}
					</MintContainer>
				}

				<Snackbar
					open={alertState.open}
					autoHideDuration={6000}
					onClose={() => setAlertState({ ...alertState, open: false })}
				>
					<Alert onClose={() => setAlertState({ ...alertState, open: false })} severity={alertState.severity}>
						{alertState.message}
					</Alert>
				</Snackbar>
			</main>
		)
	);
};

export default Home;
