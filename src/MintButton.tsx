import styled from 'styled-components';
import Button from '@material-ui/core/Button';
import { CandyMachine } from './candy-machine';
import { CircularProgress } from '@material-ui/core';
import { GatewayStatus, useGateway } from '@civic/solana-gateway-react';
import { useEffect, useState } from 'react';
import Countdown from 'react-countdown';
import { toDate } from './utils';
import './MintButton.css';

export const CTAButton = styled(Button)``; // add your styles here

export const CounterText = styled.span``; // add your styles here

export const MintButton = ({
	onMint,
	candyMachine,
	isMinting,
	mintCounter,
	availableMints,
	handleChangeMintCounter,
}: {
	onMint: () => Promise<void>;
	availableMints: number;
	candyMachine: CandyMachine | undefined;
	isMinting: boolean;
	mintCounter: number | null;
	handleChangeMintCounter: (val: number) => void;
}) => {
	const { requestGatewayToken, gatewayStatus } = useGateway();
	const [clicked, setClicked] = useState(false);
	const [isVerifying, setIsVerifying] = useState(false);
	const [isActive, setIsActive] = useState(false); // true when countdown completes

	useEffect(() => {
		setIsVerifying(false);
		if (gatewayStatus === GatewayStatus.COLLECTING_USER_INFORMATION && clicked) {
			// when user approves wallet verification txn
			setIsVerifying(true);
		} else if (gatewayStatus === GatewayStatus.ACTIVE && clicked) {
			console.log('Verified human, now minting...');
			onMint();
			setClicked(false);
		}
	}, [gatewayStatus, clicked, setClicked, onMint]);

	const isDisabled = candyMachine?.state.isSoldOut || isMinting || !isActive || isVerifying || availableMints === 0;

	return (
		<div className="mintButton">
			<CTAButton
				className="mint"
				disabled={isDisabled}
				onClick={async () => {
					if (isActive && candyMachine?.state.gatekeeper && gatewayStatus !== GatewayStatus.ACTIVE) {
						setClicked(true);
						await requestGatewayToken();
					} else {
						await onMint();
					}
				}}
				variant="contained"
			>
				{!candyMachine ? (
					'CONNECTING...'
				) : candyMachine?.state.isSoldOut ? (
					'SOLD OUT'
				) : isActive ? (
					isVerifying ? (
						'VERIFYING...'
					) : isMinting ? (
						<CircularProgress />
					) : (
						'MINT NOW'
					)
				) : candyMachine?.state.goLiveDate ? (
					<Countdown
						date={toDate(candyMachine?.state.goLiveDate)}
						onMount={({ completed }) => completed && setIsActive(true)}
						onComplete={() => {
							setIsActive(true);
						}}
						renderer={renderCounter}
					/>
				) : (
					'UNAVAILABLE'
				)}
			</CTAButton>
			<div className="ctrls">
				<button
					className="ctrlButton"
					disabled={mintCounter !== null && mintCounter <= 1}
					onClick={() => handleChangeMintCounter((mintCounter || 1) - 1)}
				>
					-
				</button>
				<input readOnly className="mintInput" disabled={isDisabled} type="text" value={mintCounter || ''} />
				<button
					className="ctrlButton"
					disabled={mintCounter !== null && mintCounter >= availableMints}
					onClick={() => handleChangeMintCounter((mintCounter || 1) + 1)}
				>
					+
				</button>
			</div>
		</div>
	);
};

const renderCounter = ({ days, hours, minutes, seconds }: any) => {
	return (
		<CounterText>
			{hours + (days || 0) * 24} hours, {minutes} minutes, {seconds} seconds
		</CounterText>
	);
};
